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
  const subtle = getWebcrypto().subtle;
  const passphraseKey = await subtle.importKey(
    "raw",
    utf8ToBytes(passphrase.normalize("NFKC")) as unknown as BufferSource,
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
