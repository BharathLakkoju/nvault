import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

// Algorithm.Argon2id — referenced by value (2) rather than the ambient
// const enum, which `isolatedModules` disallows. It is also @node-rs/argon2's
// default, but we pin it explicitly.
const ARGON2ID = 2;

/**
 * Account-password hashing. Argon2id with parameters at/above the OWASP
 * 2024 recommendation (m >= 19 MiB, t >= 2, p = 1); we use 46 MiB for extra
 * margin — comfortably within a Vercel function's memory budget.
 *
 * This is the *account* credential only. It is never used as encryption key
 * material — the vault master key is derived client-side from a separate
 * passphrase (see src/lib/crypto/kdf.ts).
 */
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 47104, // KiB (46 MiB)
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argonHash(password, OPTIONS);
}

export async function verifyPassword(hashString: string, password: string): Promise<boolean> {
  try {
    // Parameters are read from the encoded hash string, not re-supplied.
    return await argonVerify(hashString, password);
  } catch {
    return false;
  }
}
