import { createHash, randomBytes } from "node:crypto";

// JWT signing/verification (the only jose-dependent code) lives in ./jwt.
// Keeping it out of this module means importing the opaque-token helpers
// below never pulls in the ESM-only `jose` package.

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

/** Opaque refresh token — high-entropy random string, only its hash is stored. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/**
 * Prefix for CLI Personal Access Tokens. Makes the token self-identifying
 * (so `requireAuth` can route it without a DB lookup) and greppable in
 * incident response / secret scanners.
 */
export const API_TOKEN_PREFIX = "evk_";

/** Opaque CLI access token — `evk_` + 256 bits of entropy. Only its hash is stored. */
export function generateApiToken(): string {
  return API_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function isApiToken(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX);
}

/** Prefix for organization invite tokens — greppable, self-identifying. */
export const INVITE_TOKEN_PREFIX = "oiv_";

/** Opaque org invite token — `oiv_` + 256 bits of entropy. Only its hash is stored. */
export function generateInviteToken(): string {
  return INVITE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
