import { getWebcrypto } from "./webcrypto";
import { AES_KEY_BYTES } from "./random";
import { utf8ToBytes } from "./encoding";

/**
 * OWASP (2023) minimum recommendation for PBKDF2-HMAC-SHA256.
 * Stored per-user alongside the salt so it can be raised in the future
 * (re-derivation happens transparently on next successful unlock) without
 * breaking previously-provisioned vaults.
 */
export const DEFAULT_KDF_ITERATIONS = 600_000;

/**
 * Unicode normalization form applied to a passphrase before it is fed to the
 * KDF, so visually identical input derives the same key regardless of how it
 * was encoded (composed vs. decomposed, compatibility characters, …).
 */
const NORMALIZATION_FORM = "NFKC";

/**
 * Derives a 256-bit Key Encryption Key (KEK) from the user's vault
 * passphrase. This is a pure function of (passphrase, salt, iterations) —
 * it never leaves the caller's process and the server never sees the
 * passphrase or the derived KEK.
 */
export async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<Uint8Array> {
  const normalized = utf8ToBytes(passphrase.normalize(NORMALIZATION_FORM));
  return deriveKekFromBytes(normalized, salt, iterations);
}

/**
 * Same PBKDF2 construction as {@link deriveKek}, but keyed from raw secret
 * bytes rather than a UTF-8 passphrase. Used for the Organization Enrollment
 * Secret (a 128-bit generated value, see src/lib/crypto/org-enrollment.ts):
 * the iterations still matter as a brute-force speed bump if a DB dump leaks
 * the wrapped Org Key, but the secret already carries full entropy.
 */
export async function deriveKekFromBytes(
  secret: Uint8Array,
  salt: Uint8Array,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<Uint8Array> {
  const subtle = getWebcrypto().subtle;
  const passphraseKey = await subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    passphraseKey,
    AES_KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}
