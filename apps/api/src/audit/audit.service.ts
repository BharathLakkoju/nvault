import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type AuditAction =
  | "auth.register"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.device_authorized"
  | "auth.device_denied"
  | "session.revoked"
  | "session.revoked_all"
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
  targetType?: "session" | "project" | "file" | "user";
  targetId?: string;
  /**
   * Non-secret context only (e.g. a filename or project name for display in
   * the activity log). NEVER pass decrypted file contents, tokens, or key
   * material here — this table is not encrypted at rest.
   */
  metadata?: Record<string, string | number | boolean>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
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
      this.logger.error(`Failed to write audit log for action=${entry.action}`, err as Error);
    }
  }

  async listForUser(userId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });
  }
}
