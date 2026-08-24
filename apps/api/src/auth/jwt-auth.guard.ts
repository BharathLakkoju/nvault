import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../common/request-context";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload } from "./token.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(req);
    if (!token) throw new UnauthorizedException("Missing access token");

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    // Re-checked on every request (not cached) so that revoking a session
    // takes effect immediately, even though the access token itself is
    // still cryptographically valid until it expires.
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== payload.sub) {
      throw new UnauthorizedException("Session has been revoked or expired");
    }

    req.auth = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }

  private extractBearerToken(req: AuthenticatedRequest): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return undefined;
    return header.slice("Bearer ".length).trim() || undefined;
  }
}
