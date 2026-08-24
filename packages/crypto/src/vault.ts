import { aeadDecrypt, aeadEncrypt, DecryptionError } from "./aead";
import { bytesToBase64, base64ToBytes } from "./encoding";
import { unwrapKey, wrapKey, type WrappedKey } from "./envelope";
import { deriveKek, DEFAULT_KDF_ITERATIONS } from "./kdf";
import { generateDataKey, generateSalt } from "./random";

export { DecryptionError };

/**
 * Server-persistable, non-secret key material for a user's vault.
 * `wrappedMasterKey` is ciphertext — without the user's passphrase the
 * server (or anyone with a DB dump) cannot recover the master key, and
 * therefore cannot recover any project key or file content it protects.
 */
export interface VaultKeyMaterial {
  kdfSalt: string; // base64
  kdfIterations: number;
  wrappedMasterKey: WrappedKey;
}

export interface ProvisionedVault {
  keyMaterial: VaultKeyMaterial;
  /** Raw master key — keep only in memory for the life of the unlocked session. */
  masterKey: Uint8Array;
}

/** First-time vault setup: generates a brand-new master key wrapped under a freshly-derived KEK. */
export async function provisionVault(passphrase: string): Promise<ProvisionedVault> {
  const salt = generateSalt();
  const kek = await deriveKek(passphrase, salt, DEFAULT_KDF_ITERATIONS);
  const masterKey = generateDataKey();
  const wrappedMasterKey = await wrapKey(kek, masterKey, "master-key");
  return {
    keyMaterial: {
      kdfSalt: bytesToBase64(salt),
      kdfIterations: DEFAULT_KDF_ITERATIONS,
      wrappedMasterKey,
    },
    masterKey,
  };
}

/**
 * Unlocks an existing vault: re-derives the KEK from the passphrase and
 * unwraps the master key. Throws {@link DecryptionError} if the passphrase
 * is wrong — there is no separate password check, the AEAD tag itself is
 * the verifier (true zero-knowledge: the server cannot validate the
 * passphrase on its own).
 */
export async function unlockVault(
  passphrase: string,
  keyMaterial: VaultKeyMaterial,
): Promise<Uint8Array> {
  const kek = await deriveKek(
    passphrase,
    base64ToBytes(keyMaterial.kdfSalt),
    keyMaterial.kdfIterations,
  );
  return unwrapKey(kek, keyMaterial.wrappedMasterKey, "master-key");
}

/** Re-wraps the master key under a newly-derived KEK, for passphrase changes. */
export async function rewrapMasterKey(
  masterKey: Uint8Array,
  newPassphrase: string,
): Promise<VaultKeyMaterial> {
  const salt = generateSalt();
  const kek = await deriveKek(newPassphrase, salt, DEFAULT_KDF_ITERATIONS);
  const wrappedMasterKey = await wrapKey(kek, masterKey, "master-key");
  return { kdfSalt: bytesToBase64(salt), kdfIterations: DEFAULT_KDF_ITERATIONS, wrappedMasterKey };
}

export interface ProvisionedProjectKey {
  wrappedProjectKey: WrappedKey;
  projectKey: Uint8Array;
}

/** Generates a fresh per-project data key, wrapped under the user's master key. */
export async function createProjectKey(
  masterKey: Uint8Array,
  projectId: string,
): Promise<ProvisionedProjectKey> {
  const projectKey = generateDataKey();
  const wrappedProjectKey = await wrapKey(masterKey, projectKey, `project:${projectId}`);
  return { wrappedProjectKey, projectKey };
}

export async function openProjectKey(
  masterKey: Uint8Array,
  projectId: string,
  wrappedProjectKey: WrappedKey,
): Promise<Uint8Array> {
  return unwrapKey(masterKey, wrappedProjectKey, `project:${projectId}`);
}

export interface EncryptedFilePayload {
  iv: string; // base64
  ciphertext: string; // base64
}

/**
 * Encrypts one version of a file's raw bytes under its project key.
 * `fileVersionId` is bound as AAD so the ciphertext cannot be replayed
 * against a different file/version record.
 */
export async function encryptFileContent(
  projectKey: Uint8Array,
  fileVersionId: string,
  plaintext: Uint8Array,
): Promise<EncryptedFilePayload> {
  const { iv, ciphertext } = await aeadEncrypt(projectKey, plaintext, utf8(fileVersionId));
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

export async function decryptFileContent(
  projectKey: Uint8Array,
  fileVersionId: string,
  payload: EncryptedFilePayload,
): Promise<Uint8Array> {
  return aeadDecrypt(
    projectKey,
    base64ToBytes(payload.iv),
    base64ToBytes(payload.ciphertext),
    utf8(fileVersionId),
  );
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
