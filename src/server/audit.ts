import { db } from "./db";

export type AuditAction =
  | "auth.register"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "session.revoked"
  | "session.revoked_all"
  | "apitoken.created"
  | "apitoken.revoked"
  | "vaultkeypair.provisioned"
  | "project.created"
  | "project.renamed"
  | "project.deleted"
  | "project.moved_to_org"
  | "file.uploaded"
  | "file.downloaded"
  | "file.deleted"
  | "file.version_restored"
  | "org.created"
  | "org.renamed"
  | "org.deleted"
  | "org.member_invited"
  | "org.invite_revoked"
  | "org.member_joined"
  | "org.member_key_granted"
  | "org.member_removed"
  | "org.member_role_changed"
  | "org.key_rotated"
  | "org.ownership_transferred"
  | "billing.checkout_started"
  | "billing.tier_changed"
  | "billing.subscription_activated"
  | "billing.subscription_past_due"
  | "billing.subscription_canceled"
  | "billing.pending_org_purged"
  | "org.create_blocked_paywall"
  | "project.create_blocked_limit";

export interface AuditEntry {
  userId?: string | null;
  /** Set for organization-scoped actions so an org's admins can review them. */
  organizationId?: string | null;
  action: AuditAction;
  targetType?: "session" | "project" | "file" | "user" | "apitoken" | "organization" | "membership" | "invite";
  targetId?: string;
  /**
   * Non-secret context only (e.g. a filename or project name for display in
   * the activity log). NEVER pass decrypted file contents, tokens, or key
   * material here — this table is not encrypted at rest.
   */
  metadata?: Record<string, string | number | boolean>;
  ipAddress?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        organizationId: entry.organizationId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata as never,
        ipAddress: entry.ipAddress,
      },
    });
  } catch (err) {
    // Audit logging must never take down the primary request path.
    console.error(`[audit] failed to write action=${entry.action}`, err);
  }
}

export function listAuditForUser(userId: string, limit = 100) {
  return db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });
}

export function listAuditForOrg(organizationId: string, limit = 100) {
  return db.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    include: { user: { select: { email: true, name: true } } },
  });
}
