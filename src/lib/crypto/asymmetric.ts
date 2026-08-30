import { DecryptionError } from "./aead";
import { bytesToBase64, base64ToBytes } from "./encoding";
import { unwrapKey, wrapKey, type WrappedKey } from "./envelope";
import { getWebcrypto } from "./webcrypto";

/**
 * Per-user asymmetric keypair.
 *
 * The symmetric master key (see vault.ts) is enough to protect a *single*
 * user's own projects, but it cannot be shared: there is no safe way to hand
 * another person your master key. Organizations need a way for one member to
 * grant another member access to a shared key without either of them
 * revealing a long-term secret. That is what this keypair is for:
 *
 *   - The PUBLIC key is stored server-side in cleartext. Anyone may wrap a
 *     small secret (an Organization Key) to it.
 *   - The PRIVATE key is stored server-side ONLY wrapped under the user's
 *     master key (AAD "user-privkey"), exactly like a project key. The
 *     server never sees it unwrapped; only a client that has already
 *     unlocked the vault can recover it.
 *
 * Primitive: RSA-OAEP, 3072-bit modulus, SHA-256. Chosen because
 * `crypto.subtle` supports it identically in every modern browser and in
 * Node >= 20 with no polyfill, and RSA-OAEP encrypt/decrypt is a single call
 * with no key-agreement construction to get wrong. A 3072-bit key can wrap
 * up to 318 bytes with SHA-256 — far more than the 32-byte keys we wrap.
 */

export { DecryptionError };

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 3072,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: "SHA-256",
};

/** AAD binding the wrapped private key blob so it cannot be swapped onto another user's row. */
const PRIVATE_KEY_AAD = "user-privkey";

/**
 * Server-persistable, non-secret keypair material.
 * `publicKey` is cleartext SPKI (base64). `wrappedPrivateKey` is the PKCS#8
 * private key encrypted under the master key — ciphertext, opaque to the
 * server.
 */
export interface UserKeyPairMaterial {
  publicKey: string; // base64, SPKI
  wrappedPrivateKey: WrappedKey;
}

export interface ProvisionedKeyPair {
  material: UserKeyPairMaterial;
  /** Raw PKCS#8 private key bytes — keep only in memory for the unlocked session. */
  privateKey: Uint8Array;
}

function subtle(): SubtleCrypto {
  return getWebcrypto().subtle;
}

/** First-time keypair setup: generate an RSA-OAEP keypair, wrap the private half under the master key. */
export async function provisionUserKeyPair(masterKey: Uint8Array): Promise<ProvisionedKeyPair> {
  const pair = await subtle().generateKey(RSA_PARAMS, true, ["encrypt", "decrypt"]);
  const spki = new Uint8Array(await subtle().exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle().exportKey("pkcs8", pair.privateKey));
  const wrappedPrivateKey = await wrapKey(masterKey, pkcs8, PRIVATE_KEY_AAD);
  return {
    material: { publicKey: bytesToBase64(spki), wrappedPrivateKey },
    privateKey: pkcs8,
  };
}

/**
 * Recovers the raw PKCS#8 private key from its wrapped form. Throws
 * {@link DecryptionError} if the master key is wrong or the blob was tampered.
 */
export async function unwrapUserPrivateKey(
  masterKey: Uint8Array,
  material: Pick<UserKeyPairMaterial, "wrappedPrivateKey">,
): Promise<Uint8Array> {
  return unwrapKey(masterKey, material.wrappedPrivateKey, PRIVATE_KEY_AAD);
}

/** Re-wraps an existing private key under the master key (used during master-key rotation). */
export async function rewrapUserPrivateKey(
  masterKey: Uint8Array,
  privateKeyPkcs8: Uint8Array,
): Promise<WrappedKey> {
  return wrapKey(masterKey, privateKeyPkcs8, PRIVATE_KEY_AAD);
}

/**
 * Wraps `data` (e.g. a 32-byte Organization Key) to a recipient's public key.
 * Returns base64 ciphertext, safe to persist server-side. Only the holder of
 * the matching private key can recover `data`.
 */
export async function wrapToPublicKey(publicKeySpkiBase64: string, data: Uint8Array): Promise<string> {
  const key = await subtle().importKey(
    "spki",
    base64ToBytes(publicKeySpkiBase64) as unknown as BufferSource,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const ciphertext = await subtle().encrypt(
    { name: "RSA-OAEP" },
    key,
    data as unknown as BufferSource,
  );
  return bytesToBase64(new Uint8Array(ciphertext));
}

/**
 * Verifies that a stored SPKI public key really is the counterpart of a
 * (trusted, master-key-unwrapped) private key, by round-tripping a random
 * nonce through it. The wrapped private key is authenticated under the master
 * key, so it cannot be forged by the server; this closes the remaining gap
 * where a malicious server serves a bogus `publicKey` alongside it. Throws
 * {@link DecryptionError} on mismatch.
 */
export async function assertKeyPairConsistent(
  privateKeyPkcs8: Uint8Array,
  publicKeySpkiBase64: string,
): Promise<void> {
  const nonce = new Uint8Array(32);
  getWebcrypto().getRandomValues(nonce);
  const wrapped = await wrapToPublicKey(publicKeySpkiBase64, nonce);
  const recovered = await unwrapFromPrivateKey(privateKeyPkcs8, wrapped);
  if (recovered.length !== nonce.length || !recovered.every((b, i) => b === nonce[i])) {
    throw new DecryptionError("Stored public key does not match the private key.");
  }
}

/**
 * Unwraps a blob produced by {@link wrapToPublicKey} using the raw PKCS#8
 * private key. Throws {@link DecryptionError} on any failure (wrong key,
 * tampered ciphertext) so callers fail closed.
 */
export async function unwrapFromPrivateKey(
  privateKeyPkcs8: Uint8Array,
  ciphertextBase64: string,
): Promise<Uint8Array> {
  const key = await subtle().importKey(
    "pkcs8",
    privateKeyPkcs8 as unknown as BufferSource,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  try {
    const plaintext = await subtle().decrypt(
      { name: "RSA-OAEP" },
      key,
      base64ToBytes(ciphertextBase64) as unknown as BufferSource,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new DecryptionError();
  }
}
