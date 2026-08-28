import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http";
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  type IssuedTokens,
} from "./tokens";

export interface CreateSessionOptions {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

function accessTtl(): number {
  return env.JWT_ACCESS_TOKEN_TTL_SECONDS;
}
function refreshTtl(): number {
  return env.REFRESH_TOKEN_TTL_SECONDS;
}

export async function createSession(
  userId: string,
  options: CreateSessionOptions = {},
): Promise<IssuedTokens> {
  const refreshToken = generateOpaqueToken();
  const session = await db.session.create({
    data: {
      userId,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtl() * 1000),
    },
  });
  const accessToken = await signAccessToken({ sub: userId, sid: session.id });
  return { accessToken, refreshToken, accessTokenExpiresInSeconds: accessTtl() };
}

async function loadValidSession(refreshToken: string) {
  const session = await db.session.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
  return session;
}

/**
 * Cookie-based refresh (the web app). Issues a new access token and slides the
 * refresh window forward, but does NOT rotate the refresh token itself.
 *
 * Rotation was removed here on purpose: the browser can fire several refreshes
 * within the same tick (Strict Mode, a burst of 401s, multiple tabs) and a
 * rotated token races cookie propagation, logging the user out. The refresh
 * token is httpOnly, SameSite=Lax, path-scoped to /api/v1/auth and stored
 * only as a hash; session revocation is still immediate because the access
 * token is re-checked against the session row on every request.
 */
export async function refreshAccessToken(refreshToken: string): Promise<IssuedTokens> {
  const session = await loadValidSession(refreshToken);
  await db.session.update({
    where: { id: session.id },
    data: {
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + refreshTtl() * 1000),
    },
  });
  const accessToken = await signAccessToken({ sub: session.userId, sid: session.id });
  return { accessToken, refreshToken, accessTokenExpiresInSeconds: accessTtl() };
}

/** Rotating refresh, for non-cookie callers that can present the token atomically. */
export async function rotateRefreshToken(refreshToken: string): Promise<IssuedTokens> {
  const session = await loadValidSession(refreshToken);
  const newRefreshToken = generateOpaqueToken();
  await db.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(newRefreshToken),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + refreshTtl() * 1000),
    },
  });
  const accessToken = await signAccessToken({ sub: session.userId, sid: session.id });
  return {
    accessToken,
    refreshToken: newRefreshToken,
    accessTokenExpiresInSeconds: accessTtl(),
  };
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) return; // idempotent, no existence leak
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function revokeAllExcept(userId: string, keepSessionId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, id: { not: keepSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listSessions(userId: string): Promise<SessionSummary[]> {
  return db.session.findMany({
    where: { userId },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}
