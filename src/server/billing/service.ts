import {
  Prisma,
  type OrgStatus,
  type Subscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@/generated/prisma/client";
import { db } from "../db";
import { billingConfigured } from "../env";
import { ApiError } from "../http";
import { audit, type AuditAction } from "../audit";
import { authorizeOrg } from "../authz/org-access";
import { DEFAULT_TEAM_TIER, TEAM_TIER_ORDER, teamMemberLimit } from "./entitlements";
import {
  createBillingPortalUrl,
  createOrgCheckout,
  createProCheckout,
  tierForProductId,
  updateSubscriptionProduct,
} from "./polar";
import {
  isStalePolarEvent,
  parsePolarModifiedAt,
  subscriptionIdentityMatches,
} from "./polar-webhook-guards";

const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Polar status → our coarse status
// ---------------------------------------------------------------------------

interface MappedStatus {
  subscription: SubscriptionStatus;
  /** Only meaningful for TEAM subscriptions. */
  org: OrgStatus;
  /** null = don't write an audit row for this transition. */
  audit: AuditAction | null;
}

/**
 * Collapses Polar's fine-grained subscription status into our coarse model.
 * `cancelAtPeriodEnd` does NOT change the status — Polar keeps the
 * subscription `active` until the period actually ends, then sends a
 * `revoked` event with status `canceled`.
 */
export function mapPolarStatus(polarStatus: string): MappedStatus {
  switch (polarStatus) {
    case "active":
    case "trialing":
      return { subscription: "ACTIVE", org: "ACTIVE", audit: "billing.subscription_activated" };
    case "past_due":
      return { subscription: "PAST_DUE", org: "SUSPENDED", audit: "billing.subscription_past_due" };
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return { subscription: "CANCELED", org: "SUSPENDED", audit: "billing.subscription_canceled" };
    case "incomplete":
    default:
      // Checkout not finished — leave things where they are (PENDING).
      return { subscription: "PENDING", org: "PENDING_PAYMENT", audit: null };
  }
}

/** A user is "entitled to Pro" while paid or in Polar's dunning-retry window. */
export function statusGrantsEntitlement(status: SubscriptionStatus): boolean {
  return status === "ACTIVE" || status === "PAST_DUE";
}

// ---------------------------------------------------------------------------
// Webhook reducer
// ---------------------------------------------------------------------------

export interface PolarSubscriptionData {
  id: string;
  status: string;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
  customerId?: string | null;
  productId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Polar subscription `modified_at` — used to ignore stale/out-of-order events. */
  modifiedAt?: Date | string | null;
}

export interface ApplyResult {
  outcome: "applied" | "duplicate" | "ignored";
  plan?: SubscriptionPlan;
  organizationId?: string;
  userId?: string;
}

function resolvePlan(meta: Record<string, unknown> | null | undefined): SubscriptionPlan | null {
  if (meta?.plan === "PRO" || meta?.plan === "TEAM") return meta.plan;
  if (typeof meta?.organizationId === "string") return "TEAM";
  if (typeof meta?.userId === "string") return "PRO";
  return null;
}

/**
 * Idempotently applies one Polar `subscription.*` event. Safe with events
 * out of order or redelivered — the resulting state is a pure function of
 * the latest event's data. The event id is recorded only AFTER the effect
 * succeeds, so a transient failure stays replayable on Polar's next retry.
 */
export async function applyPolarSubscription(
  eventId: string,
  eventType: string,
  data: PolarSubscriptionData,
): Promise<ApplyResult> {
  if (eventId) {
    const seen = await db.processedWebhookEvent.findUnique({ where: { id: eventId } });
    if (seen) return { outcome: "duplicate" };
  }

  const plan = resolvePlan(data.metadata);
  let result: ApplyResult;
  if (plan === "TEAM") {
    result = await applyTeamSubscription(data);
  } else if (plan === "PRO") {
    result = await applyProSubscription(data);
  } else {
    console.warn(`[billing] ${eventType} ${data.id} has no resolvable plan metadata — ignored`);
    result = { outcome: "ignored" };
  }

  if (eventId && result.outcome === "applied") {
    await db.processedWebhookEvent
      .create({ data: { id: eventId, type: eventType } })
      .catch((err) => {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      });
  }
  return result;
}

async function applyTeamSubscription(data: PolarSubscriptionData): Promise<ApplyResult> {
  const organizationId =
    typeof data.metadata?.organizationId === "string" ? data.metadata.organizationId : undefined;
  if (!organizationId) return { outcome: "ignored" };

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: true,
      memberships: { where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (!org) {
    console.warn(`[billing] TEAM event references unknown org ${organizationId} — ignored`);
    return { outcome: "ignored" };
  }

  const ownerUserId = org.subscription?.ownerUserId ?? org.memberships[0]?.userId;
  if (!ownerUserId) return { outcome: "ignored" };

  if (!subscriptionIdentityMatches(org.subscription, data)) {
    console.warn(
      `[billing] TEAM event for org ${organizationId} does not match stored Polar ids — ignored`,
    );
    return { outcome: "ignored" };
  }

  const eventModifiedAt = parsePolarModifiedAt(data.modifiedAt);
  if (isStalePolarEvent(org.subscription?.polarModifiedAt, eventModifiedAt)) {
    console.warn(
      `[billing] stale TEAM event for org ${organizationId} (${eventModifiedAt?.toISOString()}) — ignored`,
    );
    return { outcome: "ignored" };
  }

  const mapped = mapPolarStatus(data.status);
  const currentPeriodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  // Tier: prefer the product the subscription is now on (survives Polar-side
  // plan changes), fall back to the checkout metadata, then the existing row.
  const metaTier =
    data.metadata?.tier === "STARTER" || data.metadata?.tier === "GROWTH" || data.metadata?.tier === "SCALE"
      ? (data.metadata.tier as SubscriptionTier)
      : null;
  const tier: SubscriptionTier =
    tierForProductId(data.productId) ?? metaTier ?? org.subscription?.tier ?? DEFAULT_TEAM_TIER;

  await db.subscription.upsert({
    where: { organizationId },
    create: {
      plan: "TEAM",
      tier,
      organizationId,
      ownerUserId,
      status: mapped.subscription,
      polarSubscriptionId: data.id,
      polarCustomerId: data.customerId ?? null,
      polarProductId: data.productId ?? null,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
      polarModifiedAt: eventModifiedAt,
    },
    update: {
      tier,
      status: mapped.subscription,
      polarSubscriptionId: data.id,
      polarCustomerId: data.customerId ?? undefined,
      polarProductId: data.productId ?? undefined,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
      ...(eventModifiedAt ? { polarModifiedAt: eventModifiedAt } : {}),
    },
  });

  if (org.status !== mapped.org) {
    await db.organization.update({ where: { id: organizationId }, data: { status: mapped.org } });
  }
  if (mapped.audit) {
    await audit({
      organizationId,
      action: mapped.audit,
      targetType: "organization",
      targetId: organizationId,
      metadata: { plan: "TEAM", polarStatus: data.status, orgStatus: mapped.org },
    });
  }
  return { outcome: "applied", plan: "TEAM", organizationId };
}

async function applyProSubscription(data: PolarSubscriptionData): Promise<ApplyResult> {
  const userId = typeof data.metadata?.userId === "string" ? data.metadata.userId : undefined;
  if (!userId) return { outcome: "ignored" };

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    console.warn(`[billing] PRO event references unknown user ${userId} — ignored`);
    return { outcome: "ignored" };
  }

  const mapped = mapPolarStatus(data.status);
  const currentPeriodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null;
  const existing = await db.subscription.findFirst({
    where: { ownerUserId: userId, plan: "PRO" },
    select: {
      id: true,
      polarSubscriptionId: true,
      polarCustomerId: true,
      polarModifiedAt: true,
    },
  });

  if (!subscriptionIdentityMatches(existing, data)) {
    console.warn(`[billing] PRO event for user ${userId} does not match stored Polar ids — ignored`);
    return { outcome: "ignored" };
  }

  const eventModifiedAt = parsePolarModifiedAt(data.modifiedAt);
  if (isStalePolarEvent(existing?.polarModifiedAt, eventModifiedAt)) {
    console.warn(
      `[billing] stale PRO event for user ${userId} (${eventModifiedAt?.toISOString()}) — ignored`,
    );
    return { outcome: "ignored" };
  }

  const fields = {
    status: mapped.subscription,
    polarSubscriptionId: data.id,
    polarCustomerId: data.customerId ?? null,
    polarProductId: data.productId ?? null,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
    ...(eventModifiedAt ? { polarModifiedAt: eventModifiedAt } : {}),
  };

  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data: fields });
  } else {
    await db.subscription
      .create({ data: { plan: "PRO", ownerUserId: userId, ...fields } })
      .catch(async (err) => {
        // A concurrent delivery created the row first — fall back to update.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const row = await db.subscription.findFirstOrThrow({
            where: { ownerUserId: userId, plan: "PRO" },
            select: { id: true },
          });
          await db.subscription.update({ where: { id: row.id }, data: fields });
          return;
        }
        throw err;
      });
  }

  if (mapped.audit) {
    await audit({
      userId,
      action: mapped.audit,
      targetType: "user",
      targetId: userId,
      metadata: { plan: "PRO", polarStatus: data.status },
    });
  }
  return { outcome: "applied", plan: "PRO", userId };
}

// ---------------------------------------------------------------------------
// Entitlement lookups
// ---------------------------------------------------------------------------

/** Whether the user currently holds a Pro subscription (paid or in dunning). */
export async function userHasActivePro(userId: string): Promise<boolean> {
  const sub = await db.subscription.findFirst({
    where: { ownerUserId: userId, plan: "PRO" },
    select: { status: true },
  });
  return sub ? statusGrantsEntitlement(sub.status) : false;
}

export function getUserProSubscription(userId: string): Promise<Subscription | null> {
  return db.subscription.findFirst({ where: { ownerUserId: userId, plan: "PRO" } });
}

/**
 * CLI access (Personal Access Tokens, `envvault run`, push/pull from a
 * terminal) is a paid capability. A user is entitled to it when they either
 *   - hold an active Pro subscription, or
 *   - are an ACTIVE member of at least one ACTIVE (paid) organization.
 *
 * When billing is not configured (local dev / self-host) the paywall is off
 * and everyone qualifies — mirroring the org auto-activation shortcut in the
 * organizations route.
 *
 * Checked on token creation and on every PAT-authenticated API request so
 * lapsed subscriptions cannot keep using long-lived CLI credentials.
 */
export async function userHasCliAccess(userId: string): Promise<boolean> {
  if (!billingConfigured()) return true;
  if (await userHasActivePro(userId)) return true;
  const activeOrgMembership = await db.organizationMembership.findFirst({
    where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
    select: { id: true },
  });
  return activeOrgMembership !== null;
}

// ---------------------------------------------------------------------------
// Checkout / portal (called from routes)
// ---------------------------------------------------------------------------

/**
 * Returns a fresh checkout URL for an org that is PENDING_PAYMENT or
 * SUSPENDED. Owner only. `tier` selects the size plan; if omitted it reuses
 * the subscription's stored tier (set at org creation), else the default.
 */
export async function startOrgCheckout(
  actorUserId: string,
  orgId: string,
  tier?: SubscriptionTier,
): Promise<string> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      memberships: { where: { userId: actorUserId } },
      subscription: { select: { tier: true } },
    },
  });
  if (!org || org.memberships.length === 0) throw new ApiError(404, "Organization not found");
  if (org.memberships[0].role !== "OWNER") {
    throw new ApiError(403, "Only the organization owner can manage billing.");
  }
  if (org.status === "ACTIVE") {
    throw new ApiError(409, "This organization's subscription is already active.");
  }

  const chosenTier = tier ?? org.subscription?.tier ?? DEFAULT_TEAM_TIER;
  const owner = await db.user.findUniqueOrThrow({
    where: { id: actorUserId },
    select: { email: true },
  });
  const url = await createOrgCheckout({
    organizationId: org.id,
    organizationName: org.name,
    ownerUserId: actorUserId,
    ownerEmail: owner.email,
    tier: chosenTier,
  });
  // Remember the choice so the webhook / a retry keep the same tier.
  await db.subscription.update({
    where: { organizationId: org.id },
    data: { tier: chosenTier },
  });
  await audit({
    userId: actorUserId,
    organizationId: org.id,
    action: "billing.checkout_started",
    targetType: "organization",
    targetId: org.id,
    metadata: { plan: "TEAM", tier: chosenTier },
  });
  return url;
}

/**
 * Switches an active organization to a different size tier via
 * `polar.subscriptions.update` (Polar prorates; the resulting
 * `subscription.updated` webhook syncs our stored tier). Owner only.
 * A downgrade is refused while the org has more members/invites than the
 * target tier allows.
 */
export async function changeOrgTier(
  actorUserId: string,
  orgId: string,
  newTier: SubscriptionTier,
): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      memberships: { where: { userId: actorUserId } },
      subscription: true,
      _count: { select: { memberships: true } },
    },
  });
  if (!org || org.memberships.length === 0) throw new ApiError(404, "Organization not found");
  if (org.memberships[0].role !== "OWNER") {
    throw new ApiError(403, "Only the organization owner can change the plan.");
  }
  const sub = org.subscription;
  if (!sub?.polarSubscriptionId || org.status !== "ACTIVE") {
    throw new ApiError(409, "The organization's subscription isn't active yet.");
  }
  if (sub.tier === newTier) {
    throw new ApiError(409, "The organization is already on that plan.");
  }

  const isDowngrade =
    TEAM_TIER_ORDER.indexOf(newTier) < TEAM_TIER_ORDER.indexOf(sub.tier ?? "SCALE");
  if (isDowngrade) {
    const pending = await db.organizationInvite.count({
      where: { organizationId: orgId, acceptedAt: null, revokedAt: null },
    });
    const used = org._count.memberships + pending;
    if (used > teamMemberLimit(newTier)) {
      throw new ApiError(
        409,
        `The smaller plan allows ${teamMemberLimit(newTier)} members; this organization has ${used}. Remove members or pending invites first.`,
      );
    }
  }

  await updateSubscriptionProduct(sub.polarSubscriptionId, newTier);
  await audit({
    userId: actorUserId,
    organizationId: orgId,
    action: "billing.tier_changed",
    targetType: "organization",
    targetId: orgId,
    metadata: { from: sub.tier ?? "unknown", to: newTier },
  });
}

/**
 * Returns a Polar checkout URL for the per-user Pro plan. Creates the local
 * PENDING subscription row if the user doesn't have one yet.
 */
export async function startProCheckout(userId: string): Promise<string> {
  const existing = await getUserProSubscription(userId);
  if (existing && statusGrantsEntitlement(existing.status)) {
    throw new ApiError(409, "You already have an active Pro subscription.");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  if (!existing) {
    await db.subscription
      .create({ data: { plan: "PRO", ownerUserId: userId, status: "PENDING" } })
      .catch((err) => {
        // Lost a race with a concurrent checkout start — fine, the row exists.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      });
  }

  const url = await createProCheckout({ userId, userEmail: user.email });
  await audit({
    userId,
    action: "billing.checkout_started",
    targetType: "user",
    targetId: userId,
    metadata: { plan: "PRO" },
  });
  return url;
}

/** Customer-portal URL for an org's billing owner. Owner only. */
export async function getBillingPortalUrl(actorUserId: string, orgId: string): Promise<string> {
  await authorizeOrg(actorUserId, orgId, "OWNER", "read");
  const sub = await db.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub || sub.ownerUserId !== actorUserId) {
    throw new ApiError(403, "Only the billing owner can open the portal.");
  }
  if (!sub.polarCustomerId) {
    throw new ApiError(409, "No billing account yet — complete checkout first.");
  }
  return createBillingPortalUrl(actorUserId);
}

/** Customer-portal URL for the caller's own (Pro) billing. */
export async function getPersonalBillingPortalUrl(userId: string): Promise<string> {
  const sub = await getUserProSubscription(userId);
  if (!sub?.polarCustomerId) {
    throw new ApiError(409, "No billing account yet — subscribe to Pro first.");
  }
  return createBillingPortalUrl(userId);
}

// ---------------------------------------------------------------------------
// DTO + purge
// ---------------------------------------------------------------------------

export function subscriptionToDto(sub: Subscription | null, actorUserId: string) {
  if (!sub) {
    return {
      status: "NONE" as const,
      tier: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      manageable: false,
    };
  }
  return {
    status: sub.status,
    tier: sub.tier,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    /** Whether THIS caller may open the billing portal for this subscription. */
    manageable: sub.ownerUserId === actorUserId && Boolean(sub.polarCustomerId),
  };
}

/**
 * Deletes organizations stuck in PENDING_PAYMENT past the TTL (abandoned
 * checkouts) and prunes never-completed PENDING Pro subscription rows.
 * Pending orgs cannot own projects, so the cascade is safe.
 */
export async function purgeExpiredPending(): Promise<{ orgs: number; proSubs: number }> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS);

  const staleOrgs = await db.organization.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    select: { id: true, name: true },
  });
  for (const org of staleOrgs) {
    await db.organization.delete({ where: { id: org.id } });
    await audit({
      action: "billing.pending_org_purged",
      targetType: "organization",
      targetId: org.id,
      metadata: { name: org.name },
    });
  }

  const { count: proSubs } = await db.subscription.deleteMany({
    where: { plan: "PRO", status: "PENDING", createdAt: { lt: cutoff } },
  });

  return { orgs: staleOrgs.length, proSubs };
}

/** Opportunistic cleanup of the webhook idempotency ledger (>90 days). */
export async function pruneProcessedWebhookEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await db.processedWebhookEvent
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch(() => {});
}
