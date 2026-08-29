import { CreateOrganizationRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { billingConfigured } from "@/server/env";
import { clientIp, handler, json, readJson } from "@/server/http";
import { startOrgCheckout } from "@/server/billing/service";
import { db } from "@/server/db";
import {
  createOrganization,
  listOrganizationsForUser,
  organizationToDto,
} from "@/server/organizations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const memberships = await listOrganizationsForUser(auth.userId);
  return json({
    organizations: memberships.map((m) => ({
      ...organizationToDto(m.organization),
      role: m.role,
      status: m.status, // membership status (INVITED / ACTIVE)
      billingStatus: m.organization.subscription?.status ?? "NONE",
      memberCount: m.organization._count.memberships,
      projectCount: m.organization._count.projects,
    })),
  });
});

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, CreateOrganizationRequestSchema);

  const org = await createOrganization(auth.userId, {
    name: dto.name,
    slug: dto.slug,
    wrappedOrgKeyCiphertext: dto.wrappedOrgKey,
    tier: dto.tier,
  });
  await audit({
    userId: auth.userId,
    organizationId: org.id,
    action: "org.created",
    targetType: "organization",
    targetId: org.id,
    metadata: { name: org.name, slug: org.slug, tier: dto.tier },
    ipAddress: clientIp(req),
  });

  // Dev / self-host convenience: with no Polar keys configured, skip the
  // paywall entirely and activate the org on the largest tier immediately.
  if (!billingConfigured()) {
    await db.organization.update({ where: { id: org.id }, data: { status: "ACTIVE" } });
    await db.subscription.update({
      where: { organizationId: org.id },
      data: { status: "ACTIVE", tier: "SCALE" },
    });
    return json(
      { organization: { ...organizationToDto(org), orgStatus: "ACTIVE" }, checkout: null },
      201,
    );
  }

  // The org now exists (PENDING_PAYMENT). If starting checkout fails, still
  // return 201 — the owner can complete payment from the org's billing page,
  // and an abandoned pending org is purged after 7 days anyway.
  try {
    const checkoutUrl = await startOrgCheckout(auth.userId, org.id, dto.tier);
    return json({ organization: organizationToDto(org), checkout: { url: checkoutUrl } }, 201);
  } catch {
    return json({ organization: organizationToDto(org), checkout: null }, 201);
  }
});
