/**
 * Resolves the WebCrypto SubtleCrypto implementation.
 *
 * Node.js (>=20) and all modern browsers expose `globalThis.crypto.subtle`,
 * so the exact same code path runs unmodified in the browser (web app) and
 * in Node (CLI) — this is what lets @envvault/crypto be the single source
 * of truth for encryption logic across both product surfaces.
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
