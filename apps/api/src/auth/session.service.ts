import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { ClientType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { generateOpaqueToken, hashToken } from "./token.util";
import type { AccessTokenPayload, IssuedTokens } from "./token.types";

export interface CreateSessionOptions {
  clientType: ClientType;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionSummary {
  id: string;
  clientType: ClientType;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class SessionService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtlSeconds = this.config.get<number>("JWT_ACCESS_TOKEN_TTL_SECONDS", 900);
    this.refreshTtlSeconds = this.config.get<number>("REFRESH_TOKEN_TTL_SECONDS", 2_592_000);
  }

  async createSession(userId: string, options: CreateSessionOptions): Promise<IssuedTokens> {
    const refreshToken = generateOpaqueToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        clientType: options.clientType,
        deviceName: options.deviceName,
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
    const accessToken = await this.signAccessToken(userId, session.id);
    return { accessToken, refreshToken, accessTokenExpiresInSeconds: this.accessTtlSeconds };
  }

  /** Rotates the refresh token on every use, so a stolen-and-replayed old token is detectable. */
  async rotateRefreshToken(refreshToken: string): Promise<IssuedTokens> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const newRefreshToken = generateOpaqueToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(newRefreshToken),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
    const accessToken = await this.signAccessToken(session.userId, session.id);
    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresInSeconds: this.accessTtlSeconds,
    };
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) return; // idempotent, no existence leak
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllExcept(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, id: { not: keepSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listSessions(userId: string): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        clientType: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    return sessions;
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    return this.jwtService.signAsync(payload, { expiresIn: this.accessTtlSeconds });
  }
}
