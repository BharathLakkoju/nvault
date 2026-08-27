"use client";

import * as vaultCrypto from "@/lib/crypto";
import type { EncryptedFilePayload } from "@/lib/crypto";

/**
 * Thin wrappers around @/lib/crypto that fix the AAD-binding conventions
 * used across this app: project keys are bound to a client-generated project
 * id, file content is bound to a client-generated contentId. See
 * src/lib/schemas/dto.ts for why these ids originate client-side rather than
 * being assigned by the server.
 */

export function newId(): string {
  return crypto.randomUUID();
}

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
  const contentId = newId();
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

export const { bytesToUtf8, utf8ToBytes, DecryptionError } = vaultCrypto;
