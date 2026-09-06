import { getWebcrypto } from "./webcrypto";
import { utf8ToBytes } from "./encoding";

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const FINGERPRINT_INFO = utf8ToBytes("file-fingerprint");

/**
 * Derives an HMAC key from the project data key. The server never sees this
 * key — fingerprints are computed client-side only.
 */
async function importFingerprintHmacKey(projectDataKey: Uint8Array): Promise<CryptoKey> {
  const subtle = getWebcrypto().subtle;
  const hkdfKey = await subtle.importKey(
    "raw",
    projectDataKey as unknown as BufferSource,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: FINGERPRINT_INFO as unknown as BufferSource,
    },
    hkdfKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
}

/**
 * HMAC-SHA256 fingerprint of file plaintext, keyed under a derivative of the
 * project data key. Used for integrity/dedup display without exposing a public
 * hash oracle to anyone with database access alone.
 */
export async function fileFingerprintHex(
  projectDataKey: Uint8Array,
  plaintext: Uint8Array,
): Promise<string> {
  const key = await importFingerprintHmacKey(projectDataKey);
  const mac = await getWebcrypto().subtle.sign(
    "HMAC",
    key,
    plaintext as unknown as BufferSource,
  );
  return toHex(mac);
}
