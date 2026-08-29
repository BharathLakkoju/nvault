import { db } from "../db";
import { ApiError } from "../http";
import { requireApiToken } from "./api-tokens";
import { verifyAccessToken } from "./jwt";
import { isApiToken } from "./tokens";

export interface AuthContext {
  userId: string;
  sessionId: string;
}

function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim() || undefined;
}

/**
 * Authenticates a request. Denies by default — handlers that should be public
 * simply never call this. The session row is re-checked on every request (not
 * cached) so that revoking a session takes effect immediately, even while the
 * access token is still cryptographically valid.
 *
 * Two credential kinds are accepted on the `Authorization: Bearer` header:
 * short-lived browser JWTs, and opaque `evk_` CLI Personal Access Tokens
 * (see api-tokens.ts). Both resolve to the same {@link AuthContext}.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const token = extractBearer(req);
  if (!token) throw new ApiError(401, "Missing access token");

  if (isApiToken(token)) {
    return requireApiToken(token);
  }

  let payload: { sub: string; sid: string };
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const session = await db.session.findUnique({ where: { id: payload.sid } });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.userId !== payload.sub
  ) {
    throw new ApiError(401, "Session has been revoked or expired");
  }

  return { userId: payload.sub, sessionId: payload.sid };
}
