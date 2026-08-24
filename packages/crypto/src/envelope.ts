import { aeadDecrypt, aeadEncrypt } from "./aead";
import { bytesToBase64, base64ToBytes, utf8ToBytes } from "./encoding";

/** A key encrypted ("wrapped") under another key, safe to persist server-side. */
export interface WrappedKey {
  iv: string; // base64
  ciphertext: string; // base64, includes GCM auth tag
}

/**
 * Wraps `keyToWrap` (raw key bytes) under `kek` (raw key bytes) using
 * AES-256-GCM. This is the building block for the envelope-encryption
 * hierarchy: KEK -> master key -> per-project data key.
 */
export async function wrapKey(
  kek: Uint8Array,
  keyToWrap: Uint8Array,
  context?: string,
): Promise<WrappedKey> {
  const { iv, ciphertext } = await aeadEncrypt(
    kek,
    keyToWrap,
    context ? utf8ToBytes(context) : undefined,
  );
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

export async function unwrapKey(
  kek: Uint8Array,
  wrapped: WrappedKey,
  context?: string,
): Promise<Uint8Array> {
  return aeadDecrypt(
    kek,
    base64ToBytes(wrapped.iv),
    base64ToBytes(wrapped.ciphertext),
    context ? utf8ToBytes(context) : undefined,
  );
}
