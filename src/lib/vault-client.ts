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

/** A fresh random 256-bit symmetric key (used for a new Organization Key). */
export function generateOrgKey(): Uint8Array {
  return vaultCrypto.generateDataKey();
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

/**
 * Provisions a fresh RSA keypair for the current user, with the private key
 * wrapped under the (already-unlocked) vault master key. The returned
 * `material` is uploaded to POST /auth/vault/keypair; `privateKey` is kept
 * in memory for the session.
 */
export async function provisionKeyPair(masterKey: Uint8Array) {
  return vaultCrypto.provisionUserKeyPair(masterKey);
}

export async function openPrivateKey(
  masterKey: Uint8Array,
  material: { wrappedPrivateKey: { iv: string; ciphertext: string } },
) {
  return vaultCrypto.unwrapUserPrivateKey(masterKey, material);
}

/** Wraps a raw key (e.g. an Organization Key) to a member's public key. */
export async function wrapForMember(publicKey: string, rawKey: Uint8Array) {
  return vaultCrypto.wrapToPublicKey(publicKey, rawKey);
}

/** Unwraps an Organization Key blob addressed to us with our private key. */
export async function openOrgKey(privateKey: Uint8Array, wrappedOrgKeyCiphertext: string) {
  return vaultCrypto.unwrapFromPrivateKey(privateKey, wrappedOrgKeyCiphertext);
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
