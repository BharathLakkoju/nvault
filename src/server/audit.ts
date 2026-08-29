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
  | "project.created"
  | "project.renamed"
  | "project.deleted"
  | "file.uploaded"
  | "file.downloaded"
  | "file.deleted"
  | "file.version_restored";

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  targetType?: "session" | "project" | "file" | "user" | "apitoken";
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
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata as never,
        ipAddress: entry.ipAddress,
      },
    });
  } catch (err) {
    // Audit logging must never take down the primary request path.
    // eslint-disable-next-line no-console
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
