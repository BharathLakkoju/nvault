/**
 * Resolves the WebCrypto SubtleCrypto implementation.
 *
 * Node.js (>=20) and all modern browsers expose `globalThis.crypto.subtle`,
 * so the exact same code path runs unmodified in the browser and in the
 * Node route handlers — one implementation, used on both sides of the wire.
 */
export function getWebcrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error(
      "WebCrypto API is unavailable in this runtime. Node.js >= 20 or a modern browser is required.",
    );
  }
  return c;
}
