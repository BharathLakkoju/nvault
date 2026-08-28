// Manual base64 (not base64url) implementation that depends on neither
// `Buffer` (Node-only) nor `btoa`/`atob` (browser-only), so it behaves
// identically in both runtimes.

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const triplet = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    result += CHARS[(triplet >> 18) & 0x3f];
    result += CHARS[(triplet >> 12) & 0x3f];
    result += b1 === undefined ? "=" : CHARS[(triplet >> 6) & 0x3f];
    result += b2 === undefined ? "=" : CHARS[triplet & 0x3f];
  }
  return result;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const padLength = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const withoutPad = clean.replace(/=+$/, "");
  const byteLength = Math.floor((withoutPad.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);
  let buffer = 0;
  let bitsInBuffer = 0;
  let outIndex = 0;
  for (const ch of withoutPad) {
    const value = CHARS.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes[outIndex++] = (buffer >> bitsInBuffer) & 0xff;
    }
  }
  void padLength;
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
