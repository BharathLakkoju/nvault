import { randomBytes } from "node:crypto";
import { db } from "../db";
import { appOrigin } from "../env";
import { ApiError } from "../http";
import { createApiToken } from "./api-tokens";
import { hashToken } from "./tokens";
import { userHasCliAccess } from "../billing/service";

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEVICE_CODE_TTL_MS = 15 * 60_000;
const POLL_INTERVAL_SECONDS = 5;
const MAX_POLLS_PER_REQUEST = 1;

export interface DeviceAuthStartResult {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

function generateUserCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += USER_CODE_ALPHABET[bytes[i]! % USER_CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function normalizeUserCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatUserCode(normalized: string): string {
  if (normalized.length !== 8) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

async function uniqueUserCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateUserCode();
    const normalized = normalizeUserCode(code);
    const existing = await db.deviceAuthRequest.findUnique({
      where: { userCode: normalized },
      select: { id: true },
    });
    if (!existing) return normalized;
  }
  throw new ApiError(503, "Could not allocate a device code — please try again.");
}

export async function startDeviceAuth(opts: {
  clientName?: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<DeviceAuthStartResult> {
  const deviceCode = randomBytes(32).toString("base64url");
  const userCode = await uniqueUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);

  await db.deviceAuthRequest.create({
    data: {
      deviceCodeHash: hashToken(deviceCode),
      userCode,
      clientName: opts.clientName?.trim() || "nvault CLI",
      userAgent: opts.userAgent,
      ipAddress: opts.ipAddress,
      expiresAt,
    },
  });

  const origin = appOrigin();
  const verificationUri = `${origin}/device`;
  const displayCode = formatUserCode(userCode);

  return {
    device_code: deviceCode,
    user_code: displayCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(displayCode)}`,
    expires_in: Math.floor(DEVICE_CODE_TTL_MS / 1000),
    interval: POLL_INTERVAL_SECONDS,
  };
}

export type DevicePollResult =
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "approved"; token: string; userEmail: string };

export async function pollDeviceAuth(deviceCode: string): Promise<DevicePollResult> {
  const row = await db.deviceAuthRequest.findUnique({
    where: { deviceCodeHash: hashToken(deviceCode) },
    include: { user: { select: { email: true } } },
  });

  if (!row || row.expiresAt < new Date()) {
    return { status: "expired" };
  }

  if (row.status === "DENIED") {
    return { status: "denied" };
  }

  const now = new Date();
  if (row.lastPollAt) {
    const elapsed = now.getTime() - row.lastPollAt.getTime();
    if (elapsed < POLL_INTERVAL_SECONDS * 1000 - 250) {
      return { status: "slow_down" };
    }
  }

  await db.deviceAuthRequest.update({
    where: { id: row.id },
    data: { pollCount: { increment: MAX_POLLS_PER_REQUEST }, lastPollAt: now },
  });

  if (row.status === "PENDING") {
    return { status: "pending" };
  }

  if (!row.approvedToken || !row.user?.email) {
    return { status: "denied" };
  }

  const token = row.approvedToken;
  await db.deviceAuthRequest.update({
    where: { id: row.id },
    data: { approvedToken: null },
  });

  return { status: "approved", token, userEmail: row.user.email };
}

export async function approveDeviceAuth(
  userId: string,
  rawUserCode: string,
): Promise<void> {
  const normalized = normalizeUserCode(rawUserCode);
  if (normalized.length !== 8) {
    throw new ApiError(400, "Enter the 8-character code shown in your terminal.");
  }

  const row = await db.deviceAuthRequest.findUnique({ where: { userCode: normalized } });
  if (!row || row.expiresAt < new Date()) {
    throw new ApiError(404, "That code is invalid or has expired. Run `nvault login` again.");
  }
  if (row.status !== "PENDING") {
    throw new ApiError(409, "That code has already been used.");
  }

  const hasCliAccess = await userHasCliAccess(userId);
  const created = await createApiToken(
    userId,
    { name: row.clientName ?? "CLI device login" },
    { hasCliAccess },
  );

  await db.deviceAuthRequest.update({
    where: { id: row.id },
    data: {
      status: "APPROVED",
      userId,
      approvedToken: created.token,
      approvedSessionId: created.id,
    },
  });
}

/** Opportunistic cleanup of expired device auth rows. */
export async function pruneExpiredDeviceAuth(): Promise<void> {
  await db.deviceAuthRequest.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 60_000) } },
  });
}
