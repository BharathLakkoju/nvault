import { db } from "../db";
import { assertCanCreateCliToken } from "../billing/entitlements";
import { ApiError } from "../http";
import { generateApiToken, generateOpaqueToken, hashToken } from "./tokens";

/**
 * CLI Personal Access Tokens (PATs).
 *
 * A PAT is modelled as a long-lived {@link Session} row carrying an
 * `apiTokenHash` instead of being reached via the refresh-token cookie
 * flow. Reusing the session row means file-version attribution, immediate
 * revocation (the session row is re-checked on every request in
 * `requireAuth`) and the audit trail all work through the existing
 * machinery with no new relations.
 *
 * The raw token is returned exactly once, at creation. Only its sha256 is
 * ever stored. The vault passphrase / master key is never involved here —
 * a PAT authenticates API calls; it does not decrypt anything.
 */

const DEFAULT_TTL_DAYS = 365;

export interface CreatedApiToken {
  id: string;
  /** Shown once, never retrievable again. */
  token: string;
  name: string;
  tokenPrefix: string;
  createdAt: Date;
  expiresAt: Date;
}

export async function createApiToken(
  userId: string,
  input: { name: string; expiresInDays?: number },
  opts: { hasPro: boolean },
): Promise<CreatedApiToken> {
  const activeCount = await db.session.count({
    where: { userId, apiTokenHash: { not: null }, revokedAt: null },
  });
  assertCanCreateCliToken(activeCount, opts.hasPro);

  const raw = generateApiToken();
  const ttlDays = input.expiresInDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

  const session = await db.session.create({
    data: {
      userId,
      userAgent: "nvault CLI",
      // PATs never use the refresh flow; this satisfies the NOT NULL + UNIQUE
      // constraint with a value nobody holds.
      refreshTokenHash: hashToken(generateOpaqueToken()),
      apiTokenHash: hashToken(raw),
      apiTokenPrefix: raw.slice(0, 12),
      apiTokenName: input.name,
      expiresAt,
    },
  });

  return {
    id: session.id,
    token: raw,
    name: input.name,
    tokenPrefix: session.apiTokenPrefix ?? raw.slice(0, 12),
    createdAt: session.createdAt,
    expiresAt,
  };
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  const rows = await db.session.findMany({
    where: { userId, apiTokenHash: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      apiTokenName: true,
      apiTokenPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.apiTokenName ?? "CLI token",
    tokenPrefix: r.apiTokenPrefix ?? "evk_",
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
  }));
}

/** Idempotent, and never leaks whether the id existed. */
export async function revokeApiToken(userId: string, id: string): Promise<void> {
  const session = await db.session.findUnique({ where: { id } });
  if (!session || session.userId !== userId || !session.apiTokenHash) return;
  if (session.revokedAt) return;
  await db.session.update({ where: { id }, data: { revokedAt: new Date() } });
}

/**
 * Resolves an `evk_` bearer token to its session. Throws 401 on any
 * problem (unknown / revoked / expired) with a single generic message.
 */
export async function requireApiToken(
  rawToken: string,
): Promise<{ userId: string; sessionId: string }> {
  const session = await db.session.findUnique({
    where: { apiTokenHash: hashToken(rawToken) },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new ApiError(401, "Invalid or expired API token");
  }
  // Best-effort last-used bump — never block the request path on it.
  void db.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return { userId: session.userId, sessionId: session.id };
}
