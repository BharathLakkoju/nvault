import { randomBytes, randomInt, createHash } from "node:crypto";

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Excludes visually ambiguous characters (0/O, 1/I/L) to keep the code easy
// to type correctly on a second device.
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateUserCode(): string {
  const part = () =>
    Array.from({ length: 4 }, () => USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]).join(
      "",
    );
  return `${part()}-${part()}`;
}

export function normalizeUserCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
