import { Controller, Get } from "@nestjs/common";
import { CurrentAuth } from "../common/decorators/current-user.decorator";
import type { AuthContext } from "../common/request-context";
import { AuditService } from "./audit.service";

@Controller("audit-log")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext) {
    const entries = await this.auditService.listForUser(auth.userId);
    return { entries };
  }
}
