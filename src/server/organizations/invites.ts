import type { OrganizationMembership, OrgRole } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../http";
import { generateInviteToken, hashToken } from "../auth/tokens";
import { canActOnRole } from "../authz/roles";
import { MAX_MEMBERS_PER_ORG, MAX_PENDING_INVITES_PER_ORG } from "./service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedInvite {
  id: string;
  /** Raw token — returned exactly once, for the admin to share out-of-band. */
  token: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
}

/**
 * Creates (or replaces) a pending invite. The inviter must already be
 * authorized as ADMIN+ for the org; this additionally enforces that they
 * cannot grant a role at or above their own unless they are OWNER, and does
 * not disclose whether `email` already has an account.
 */
export async function createInvite(
  orgId: string,
  inviter: OrganizationMembership,
  input: { email: string; role: OrgRole },
): Promise<CreatedInvite> {
  if (!canActOnRole(inviter.role, input.role)) {
    throw new ApiError(403, "You can't invite someone at your own role or higher.");
  }

  // Already a member (active or pending)?
  const existingMember = await db.organizationMembership.findFirst({
    where: { organizationId: orgId, user: { email: input.email } },
  });
  if (existingMember) {
    throw new ApiError(409, "That person is already a member of this organization.");
  }

  const memberCount = await db.organizationMembership.count({ where: { organizationId: orgId } });
  if (memberCount >= MAX_MEMBERS_PER_ORG) {
    throw new ApiError(409, `This organization has reached the ${MAX_MEMBERS_PER_ORG}-member limit.`);
  }

  const pendingCount = await db.organizationInvite.count({
    where: { organizationId: orgId, acceptedAt: null, revokedAt: null },
  });
  if (pendingCount >= MAX_PENDING_INVITES_PER_ORG) {
    throw new ApiError(409, "Too many pending invitations. Revoke some before sending more.");
  }

  // Replace any prior un-accepted invite for this address (lets you re-invite
  // at a different role) — revoke rather than delete for the audit trail.
  await db.organizationInvite.updateMany({
    where: { organizationId: orgId, email: input.email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const raw = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invite = await db.organizationInvite.create({
    data: {
      organizationId: orgId,
      email: input.email,
      role: input.role,
      tokenHash: hashToken(raw),
      tokenPrefix: raw.slice(0, 12),
      invitedById: inviter.userId,
      expiresAt,
    },
  });

  return { id: invite.id, token: raw, email: invite.email, role: invite.role, expiresAt };
}

export function listPendingInvites(orgId: string) {
  return db.organizationInvite.findMany({
    where: { organizationId: orgId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { email: true, name: true } } },
  });
}

/** Idempotent; never reveals whether the id existed. */
export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  const invite = await db.organizationInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizationId !== orgId || invite.acceptedAt || invite.revokedAt) return;
  await db.organizationInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
}

export interface AcceptedInvite {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
  membershipId: string;
}

/**
 * Accepts an invite as the authenticated caller. The invite email must match
 * the caller's account email exactly (so a leaked link can't be redeemed by a
 * different account), the caller must have provisioned a keypair, and must
 * not already be a member. The new membership is INVITED until an admin
 * grants the Org Key.
 */
export async function acceptInvite(
  userId: string,
  userEmail: string,
  rawToken: string,
): Promise<AcceptedInvite> {
  const invite = await db.organizationInvite.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { organization: { select: { id: true, name: true } } },
  });
  const genericError = "This invitation is invalid or has expired.";
  if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new ApiError(404, genericError);
  }
  if (invite.email !== userEmail) {
    throw new ApiError(403, "This invitation was sent to a different email address.");
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { publicKey: true } });
  if (!user?.publicKey) {
    throw new ApiError(
      409,
      "Unlock your vault to set up your encryption keypair, then accept this invitation.",
    );
  }

  const already = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
  });
  if (already) {
    throw new ApiError(409, "You are already a member of this organization.");
  }

  const membership = await db.organizationMembership.create({
    data: {
      organizationId: invite.organizationId,
      userId,
      role: invite.role,
      status: "INVITED",
      invitedById: invite.invitedById,
    },
  });
  await db.organizationInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return {
    organizationId: invite.organization.id,
    organizationName: invite.organization.name,
    role: invite.role,
    membershipId: membership.id,
  };
}

export function inviteToDto(invite: {
  id: string;
  email: string;
  role: OrgRole;
  tokenPrefix: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { email: string; name: string | null } | null;
}) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    tokenPrefix: invite.tokenPrefix,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    invitedByEmail: invite.invitedBy?.email ?? null,
  };
}
