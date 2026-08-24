import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { ClientType } from "@prisma/client";
import type { LoginRequest, RegisterRequest } from "@envvault/types";
import { UsersService } from "../users/users.service";
import { SessionService } from "./session.service";
import { AuditService } from "../audit/audit.service";
import type { IssuedTokens } from "./token.types";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  tokens: IssuedTokens;
  user: ReturnType<UsersService["toPublicProfile"]>;
  vaultKeyMaterial: ReturnType<UsersService["toVaultKeyMaterial"]>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterRequest, meta: RequestMeta): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({ ...dto, passwordHash });

    const tokens = await this.sessionService.createSession(user.id, {
      clientType: ClientType.WEB,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.auditService.log({
      userId: user.id,
      action: "auth.register",
      targetType: "user",
      targetId: user.id,
      ipAddress: meta.ipAddress,
    });

    return {
      tokens,
      user: this.usersService.toPublicProfile(user),
      vaultKeyMaterial: this.usersService.toVaultKeyMaterial(user),
    };
  }

  async login(dto: LoginRequest, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    const genericError = "Invalid email or password";

    if (!user) {
      // Still run a hash verification against a dummy value so that login
      // timing does not reveal whether the email exists.
      await argon2.hash(dto.password).catch(() => undefined);
      await this.auditService.log({ action: "auth.login_failed", ipAddress: meta.ipAddress });
      throw new UnauthorizedException(genericError);
    }

    const valid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      await this.auditService.log({
        userId: user.id,
        action: "auth.login_failed",
        ipAddress: meta.ipAddress,
      });
      throw new UnauthorizedException(genericError);
    }

    const tokens = await this.sessionService.createSession(user.id, {
      clientType: ClientType.WEB,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.auditService.log({
      userId: user.id,
      action: "auth.login",
      ipAddress: meta.ipAddress,
    });

    return {
      tokens,
      user: this.usersService.toPublicProfile(user),
      vaultKeyMaterial: this.usersService.toVaultKeyMaterial(user),
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return {
      user: this.usersService.toPublicProfile(user),
      vaultKeyMaterial: this.usersService.toVaultKeyMaterial(user),
    };
  }

  async logout(userId: string, sessionId: string, ipAddress?: string): Promise<void> {
    await this.sessionService.revokeSession(userId, sessionId);
    await this.auditService.log({
      userId,
      action: "auth.logout",
      targetType: "session",
      targetId: sessionId,
      ipAddress,
    });
  }
}
