import {
  Prisma,
  type OrgRole,
  type OrgStatus,
  type Organization,
  type SubscriptionTier,
} from "@/generated/prisma/client";
import { db } from "../db";
import { ApiError } from "../http";

/** Guardrails against resource exhaustion / abuse. */
export const MAX_ORGS_OWNED_PER_USER = 10;
/** Hard ceiling; the effective per-org member cap is the subscription tier's. */
export const MAX_MEMBERS_PER_ORG = 100;
export const MAX_PENDING_INVITES_PER_ORG = 100;

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  /** Org Key, RSA-wrapped to the creator's own public key. Opaque ciphertext. */
  wrappedOrgKeyCiphertext: string;
  /** Team size tier chosen at creation. */
  tier: SubscriptionTier;
}

/**
 * Creates an organization and makes the caller its first OWNER.
 *
 * No interactive transaction (transaction-mode pooler): writes are ordered so
 * a mid-way failure leaves nothing usable, and the org row is deleted as
 * compensation. The unique `slug` constraint is the race guard.
 */
export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
): Promise<Organization> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { publicKey: true },
  });
  if (!user?.publicKey) {
    throw new ApiError(
      409,
      "Your account needs an encryption keypair before you can create an organization. Unlock your vault and try again.",
    );
  }

  const ownedCount = await db.organizationMembership.count({
    where: { userId, role: "OWNER" },
  });
  if (ownedCount >= MAX_ORGS_OWNED_PER_USER) {
    throw new ApiError(409, `You can own at most ${MAX_ORGS_OWNED_PER_USER} organizations.`);
  }

  let org: Organization;
  try {
    org = await db.organization.create({
      data: { name: input.name, slug: input.slug, currentKeyEpoch: 0 },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "That organization URL is already taken.");
    }
    throw err;
  }

  try {
    await db.organizationKeyEpoch.create({
      data: { organizationId: org.id, epoch: 0, rotatedById: userId },
    });
    await db.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
        wrappedOrgKeyCiphertext: input.wrappedOrgKeyCiphertext,
        keyEpoch: 0,
        keyGrantedAt: new Date(),
        invitedById: userId,
      },
    });
    // The org starts life PENDING_PAYMENT (schema default). Its subscription
    // shell is created here; the Polar webhook fills in the ids and flips
    // both to ACTIVE once checkout completes.
    await db.subscription.create({
      data: {
        organizationId: org.id,
        ownerUserId: userId,
        plan: "TEAM",
        tier: input.tier,
        status: "PENDING",
      },
    });
  } catch (err) {
    await db.organization.delete({ where: { id: org.id } }).catch(() => {});
    throw err;
  }

  return org;
}

/** Every org the user belongs to (active or pending), with their membership. */
export function listOrganizationsForUser(userId: string) {
  return db.organizationMembership.findMany({
    where: { userId },
    orderBy: { organization: { name: "asc" } },
    include: {
      organization: {
        include: {
          _count: { select: { memberships: true, projects: true } },
          subscription: { select: { status: true, tier: true } },
        },
      },
    },
  });
}

/**
 * Loads an org the caller belongs to, in any membership status, with the full
 * member list (including each member's public key, which admin clients need
 * to wrap keys). Throws 404 if the caller is not a member — existence is not
 * probeable.
 */
export async function getOrganizationForMember(userId: string, orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, email: true, name: true, publicKey: true } },
        },
      },
      _count: { select: { projects: true } },
    },
  });
  if (!org) throw new ApiError(404, "Organization not found");

  const self = org.memberships.find((m) => m.userId === userId);
  if (!self) throw new ApiError(404, "Organization not found");

  return { org, self };
}

export async function renameOrganization(
  orgId: string,
  input: { name?: string; slug?: string },
): Promise<Organization> {
  try {
    return await db.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "That organization URL is already taken.");
    }
    throw err;
  }
}

/** Deletes an org. Refuses while it still owns projects — a deliberate speed bump. */
export async function deleteOrganization(orgId: string): Promise<void> {
  const projectCount = await db.project.count({ where: { organizationId: orgId } });
  if (projectCount > 0) {
    throw new ApiError(
      409,
      "Delete or move this organization's projects before deleting the organization.",
    );
  }
  await db.organization.delete({ where: { id: orgId } });
}

export function organizationToDto(org: {
  id: string;
  name: string;
  slug: string;
  currentKeyEpoch: number;
  status: OrgStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    currentKeyEpoch: org.currentKeyEpoch,
    orgStatus: org.status,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

export function membershipToDto(m: {
  id: string;
  userId: string;
  role: OrgRole;
  status: string;
  keyEpoch: number | null;
  createdAt: Date;
  keyGrantedAt: Date | null;
  user: { id: string; email: string; name: string | null; publicKey: string | null };
}) {
  return {
    id: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    publicKey: m.user.publicKey,
    role: m.role,
    status: m.status,
    keyEpoch: m.keyEpoch,
    createdAt: m.createdAt,
    keyGrantedAt: m.keyGrantedAt,
  };
}
