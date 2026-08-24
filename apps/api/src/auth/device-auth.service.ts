import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeviceAuthStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { generateOpaqueToken, generateUserCode, normalizeUserCode } from "./token.util";

export class DeviceFlowError extends BadRequestException {
  constructor(public readonly code: "authorization_pending" | "slow_down" | "access_denied" | "expired_token" | "invalid_grant") {
    super({ error: code });
  }
}

@Injectable()
export class DeviceAuthService {
  private readonly ttlSeconds: number;
  private readonly pollIntervalSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.ttlSeconds = this.config.get<number>("DEVICE_AUTH_TTL_SECONDS", 600);
    this.pollIntervalSeconds = this.config.get<number>("DEVICE_AUTH_POLL_INTERVAL_SECONDS", 5);
  }

  async start(deviceName?: string) {
    const deviceCode = generateOpaqueToken(32);
    let userCode = generateUserCode();
    // Vanishingly unlikely collision, but guard against it explicitly rather
    // than relying on the unique constraint to throw an opaque 500.
    while (await this.prisma.deviceAuthRequest.findUnique({ where: { userCode } })) {
      userCode = generateUserCode();
    }

    await this.prisma.deviceAuthRequest.create({
      data: {
        deviceCode,
        userCode,
        deviceName,
        expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
      },
    });

    return {
      deviceCode,
      userCode,
      expiresInSeconds: this.ttlSeconds,
      pollIntervalSeconds: this.pollIntervalSeconds,
    };
  }

  async lookup(userCode: string) {
    const req = await this.prisma.deviceAuthRequest.findUnique({
      where: { userCode: normalizeUserCode(userCode) },
    });
    if (!req || req.expiresAt < new Date() || req.status !== DeviceAuthStatus.PENDING) {
      throw new DeviceFlowError("invalid_grant");
    }
    return { deviceName: req.deviceName, expiresAt: req.expiresAt };
  }

  async approve(userCode: string, userId: string): Promise<void> {
    const req = await this.assertPending(userCode);
    await this.prisma.deviceAuthRequest.update({
      where: { id: req.id },
      data: { status: DeviceAuthStatus.APPROVED, userId },
    });
  }

  async deny(userCode: string): Promise<void> {
    const req = await this.assertPending(userCode);
    await this.prisma.deviceAuthRequest.update({
      where: { id: req.id },
      data: { status: DeviceAuthStatus.DENIED },
    });
  }

  /** Returns the approved request's userId+deviceName exactly once, then marks it consumed. */
  async consumeIfApproved(deviceCode: string): Promise<{ userId: string; deviceName: string | null }> {
    const req = await this.prisma.deviceAuthRequest.findUnique({ where: { deviceCode } });
    if (!req) throw new DeviceFlowError("invalid_grant");

    if (req.expiresAt < new Date()) {
      if (req.status === DeviceAuthStatus.PENDING) {
        await this.prisma.deviceAuthRequest.update({
          where: { id: req.id },
          data: { status: DeviceAuthStatus.EXPIRED },
        });
      }
      throw new DeviceFlowError("expired_token");
    }

    await this.prisma.deviceAuthRequest.update({
      where: { id: req.id },
      data: { lastPolledAt: new Date() },
    });

    switch (req.status) {
      case DeviceAuthStatus.PENDING:
        throw new DeviceFlowError("authorization_pending");
      case DeviceAuthStatus.DENIED:
        throw new DeviceFlowError("access_denied");
      case DeviceAuthStatus.EXPIRED:
      case DeviceAuthStatus.CONSUMED:
        throw new DeviceFlowError("expired_token");
      case DeviceAuthStatus.APPROVED: {
        if (!req.userId) throw new DeviceFlowError("invalid_grant");
        await this.prisma.deviceAuthRequest.update({
          where: { id: req.id },
          data: { status: DeviceAuthStatus.CONSUMED },
        });
        return { userId: req.userId, deviceName: req.deviceName };
      }
    }
  }

  private async assertPending(userCode: string) {
    const req = await this.prisma.deviceAuthRequest.findUnique({
      where: { userCode: normalizeUserCode(userCode) },
    });
    if (!req || req.expiresAt < new Date() || req.status !== DeviceAuthStatus.PENDING) {
      throw new DeviceFlowError("invalid_grant");
    }
    return req;
  }
}
