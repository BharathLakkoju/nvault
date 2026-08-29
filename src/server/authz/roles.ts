import type { OrgRole } from "@prisma/client";

/**
 * Organization role hierarchy. Higher rank strictly implies every capability
 * of a lower rank.
 *
 *   OWNER  — everything, plus delete org / transfer ownership.
 *   ADMIN  — manage members and invites, create/delete/move org projects,
 *            rotate the Org Key.
 *   MEMBER — read and write files in every org project.
 */
export const ROLE_RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: OrgRole, min: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Whether `actorRole` may assign / act on `targetRole`. An actor can only
 * touch roles strictly below their own — except OWNER, who can act on anyone
 * (including granting/transferring OWNER).
 */
export function canActOnRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (actorRole === "OWNER") return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
