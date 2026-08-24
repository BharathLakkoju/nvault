import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { DeviceApproveRequestSchema, LoginRequestSchema, RegisterRequestSchema } from "@envvault/types";
import type { DeviceApproveRequest } from "@envvault/types";
import { ClientType } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { CurrentAuth } from "../common/decorators/current-user.decorator";
import type { AuthContext, AuthenticatedRequest } from "../common/request-context";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { DeviceAuthService } from "./device-auth.service";
import { AuditService } from "../audit/audit.service";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./cookie.util";
import {
  DeviceStartRequestSchema,
  DeviceTokenRequestSchema,
  RefreshRequestSchema,
} from "./auth.local-dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly deviceAuthService: DeviceAuthService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register")
  @UsePipes(new ZodValidationPipe(RegisterRequestSchema))
  async register(
    @Body() dto: import("@envvault/types").RegisterRequest,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setRefreshCookie(res, result.tokens.refreshToken, this.refreshCookieTtl(result));
    return {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresInSeconds: result.tokens.accessTokenExpiresInSeconds,
      user: result.user,
      vaultKeyMaterial: result.vaultKeyMaterial,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(
    @Body() dto: import("@envvault/types").LoginRequest,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setRefreshCookie(res, result.tokens.refreshToken, this.refreshCookieTtl(result));
    return {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresInSeconds: result.tokens.accessTokenExpiresInSeconds,
      user: result.user,
      vaultKeyMaterial: result.vaultKeyMaterial,
    };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(RefreshRequestSchema))
  async refresh(
    @Body() dto: { refreshToken?: string },
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshCookie(req) ?? dto.refreshToken;
    if (!refreshToken) throw new UnauthorizedException("Missing refresh token");

    const tokens = await this.sessionService.rotateRefreshToken(refreshToken);
    if (readRefreshCookie(req)) {
      setRefreshCookie(res, tokens.refreshToken, tokens.accessTokenExpiresInSeconds);
    }
    return {
      accessToken: tokens.accessToken,
      accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
      // Only returned for non-cookie (CLI) clients; harmless to include either way
      // since it is only ever transmitted over TLS to the authenticated caller.
      refreshToken: readRefreshCookie(req) ? undefined : tokens.refreshToken,
    };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(auth.userId, auth.sessionId, req.ip);
    clearRefreshCookie(res);
  }

  @Get("me")
  async me(@CurrentAuth() auth: AuthContext) {
    return this.authService.me(auth.userId);
  }

  @Get("sessions")
  async listSessions(@CurrentAuth() auth: AuthContext) {
    const sessions = await this.sessionService.listSessions(auth.userId);
    return { sessions: sessions.map((s) => ({ ...s, current: s.id === auth.sessionId })) };
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  async revokeSession(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    await this.sessionService.revokeSession(auth.userId, id);
    await this.auditService.log({
      userId: auth.userId,
      action: "session.revoked",
      targetType: "session",
      targetId: id,
    });
  }

  @Post("sessions/revoke-others")
  @HttpCode(204)
  async revokeOtherSessions(@CurrentAuth() auth: AuthContext) {
    await this.sessionService.revokeAllExcept(auth.userId, auth.sessionId);
    await this.auditService.log({ userId: auth.userId, action: "session.revoked_all" });
  }

  // ---------------------------------------------------------------------
  // Device authorization flow (CLI login without typing the account
  // password into the terminal).
  // ---------------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("device/start")
  @UsePipes(new ZodValidationPipe(DeviceStartRequestSchema))
  async deviceStart(@Body() dto: { deviceName?: string }) {
    const result = await this.deviceAuthService.start(dto.deviceName);
    return {
      deviceCode: result.deviceCode,
      userCode: result.userCode,
      verificationUri: `${this.config.get<string>("WEB_ORIGIN", "http://localhost:3000")}/device`,
      expiresInSeconds: result.expiresInSeconds,
      pollIntervalSeconds: result.pollIntervalSeconds,
    };
  }

  @Get("device/lookup")
  async deviceLookup(@Query("userCode") userCode?: string) {
    if (!userCode) throw new BadRequestException("Missing userCode query parameter");
    return this.deviceAuthService.lookup(userCode);
  }

  @Post("device/approve")
  @HttpCode(204)
  async deviceApprove(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(DeviceApproveRequestSchema)) body: DeviceApproveRequest,
  ) {
    await this.deviceAuthService.approve(body.userCode, auth.userId);
    await this.auditService.log({ userId: auth.userId, action: "auth.device_authorized" });
  }

  @Post("device/deny")
  @HttpCode(204)
  async deviceDeny(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(DeviceApproveRequestSchema)) body: DeviceApproveRequest,
  ) {
    await this.deviceAuthService.deny(body.userCode);
    await this.auditService.log({ userId: auth.userId, action: "auth.device_denied" });
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("device/token")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(DeviceTokenRequestSchema))
  async deviceToken(@Body() dto: { deviceCode: string }, @Req() req: AuthenticatedRequest) {
    const { userId, deviceName } = await this.deviceAuthService.consumeIfApproved(dto.deviceCode);
    const tokens = await this.sessionService.createSession(userId, {
      clientType: ClientType.CLI,
      deviceName: deviceName ?? undefined,
      ipAddress: req.ip,
    });
    const result = await this.authService.me(userId);
    return { ...tokens, user: result.user, vaultKeyMaterial: result.vaultKeyMaterial };
  }

  private refreshCookieTtl(_result: unknown): number {
    // The cookie's maxAge tracks the refresh token's lifetime, which is
    // independent of the (much shorter) access token TTL.
    return this.config.get<number>("REFRESH_TOKEN_TTL_SECONDS", 2_592_000);
  }
}
