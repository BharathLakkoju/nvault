import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const ttl = env.JWT_ACCESS_TOKEN_TTL_SECONDS;
  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
    throw new Error("Malformed access token payload");
  }
  return { sub: payload.sub, sid: payload.sid };
}

/** Opaque refresh token — high-entropy random string, only its hash is stored. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
