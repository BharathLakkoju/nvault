import { getWebcrypto } from "./webcrypto";

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Content checksum for metadata/dedup purposes only — never used as key material. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await getWebcrypto().subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return toHex(digest);
}
