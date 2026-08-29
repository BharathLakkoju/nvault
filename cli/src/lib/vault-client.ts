import { randomUUID } from "node:crypto";
import * as vaultCrypto from "@core/crypto";
import type { EncryptedFilePayload } from "@core/crypto";

/**
 * Thin wrappers around the shared vault crypto (identical to the web app's
 * src/lib/vault-client.ts) that fix this product's AAD-binding conventions:
 * a project key is bound to its client-generated project id, and file
 * content is bound to a client-generated contentId.
 */

export async function createWrappedProjectKey(masterKey: Uint8Array, projectId: string) {
  return vaultCrypto.createProjectKey(masterKey, projectId);
}

export async function openProjectKey(
  masterKey: Uint8Array,
  projectId: string,
  wrappedProjectKey: { iv: string; ciphertext: string },
) {
  return vaultCrypto.openProjectKey(masterKey, projectId, wrappedProjectKey);
}

export async function encryptFile(projectKey: Uint8Array, plaintext: Uint8Array) {
  const contentId = randomUUID();
  const payload = await vaultCrypto.encryptFileContent(projectKey, contentId, plaintext);
  const plaintextSha256 = await vaultCrypto.sha256Hex(plaintext);
  return { contentId, payload, plaintextSize: plaintext.length, plaintextSha256 };
}

export async function decryptFile(
  projectKey: Uint8Array,
  payload: EncryptedFilePayload & { contentId: string },
): Promise<Uint8Array> {
  return vaultCrypto.decryptFileContent(projectKey, payload.contentId, payload);
}

export async function provisionKeyPair(masterKey: Uint8Array) {
  return vaultCrypto.provisionUserKeyPair(masterKey);
}

export async function unwrapPrivateKey(
  masterKey: Uint8Array,
  material: { wrappedPrivateKey: { iv: string; ciphertext: string } },
) {
  return vaultCrypto.unwrapUserPrivateKey(masterKey, material);
}

/** Unwraps an Organization Key blob addressed to us with our RSA private key. */
export async function openOrgKey(privateKey: Uint8Array, wrappedOrgKeyCiphertext: string) {
  return vaultCrypto.unwrapFromPrivateKey(privateKey, wrappedOrgKeyCiphertext);
}

export const { bytesToUtf8, utf8ToBytes, sha256Hex } = vaultCrypto;
export const newId = randomUUID;
