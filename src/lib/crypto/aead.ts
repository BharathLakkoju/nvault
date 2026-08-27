import { getWebcrypto } from "./webcrypto";
import { generateIv } from "./random";

export class DecryptionError extends Error {
  constructor(message = "Decryption failed: wrong key or the ciphertext has been tampered with.") {
    super(message);
    this.name = "DecryptionError";
  }
}

export interface AeadResult {
  iv: Uint8Array;
  /** Ciphertext with the 128-bit GCM authentication tag appended (WebCrypto convention). */
  ciphertext: Uint8Array;
}

async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return getWebcrypto().subtle.importKey("raw", rawKey as unknown as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts `plaintext` with AES-256-GCM under `rawKey`.
 * `aad` (additional authenticated data) is optional context — e.g. a file
 * or project id — that is authenticated but not encrypted, binding the
 * ciphertext to the record it belongs to so it cannot be silently swapped
 * with another encrypted blob that happens to share a key.
 */
export async function aeadEncrypt(
  rawKey: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Promise<AeadResult> {
  const subtle = getWebcrypto().subtle;
  const key = await importAesGcmKey(rawKey);
  const iv = generateIv();
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource | undefined },
    key,
    plaintext as unknown as BufferSource,
  );
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

export async function aeadDecrypt(
  rawKey: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const subtle = getWebcrypto().subtle;
  const key = await importAesGcmKey(rawKey);
  try {
    const plaintext = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource | undefined },
      key,
      ciphertext as unknown as BufferSource,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new DecryptionError();
  }
}
