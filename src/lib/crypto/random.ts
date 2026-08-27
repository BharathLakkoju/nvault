import { getWebcrypto } from "./webcrypto";

export const AES_KEY_BYTES = 32; // AES-256
export const GCM_IV_BYTES = 12; // 96-bit nonce recommended for AES-GCM
export const KDF_SALT_BYTES = 16;

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getWebcrypto().getRandomValues(bytes);
  return bytes;
}

/** Generates a fresh random 256-bit symmetric key (master key or per-project data key). */
export function generateDataKey(): Uint8Array {
  return randomBytes(AES_KEY_BYTES);
}

export function generateSalt(): Uint8Array {
  return randomBytes(KDF_SALT_BYTES);
}

export function generateIv(): Uint8Array {
  return randomBytes(GCM_IV_BYTES);
}
