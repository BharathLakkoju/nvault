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

/** Re-wraps an existing project key under a different wrapping key (Org Key rotation). */
export async function rewrapProjectKey(
  wrappingKey: Uint8Array,
  projectId: string,
  projectKey: Uint8Array,
) {
  return vaultCrypto.wrapProjectKey(wrappingKey, projectId, projectKey);
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

// --- Organization Enrollment Secret + roster ----------------------------

export type OrgEnrollmentBlob = {
  kdfSalt: string;
  kdfIterations: number;
  wrappedOrgKey: { iv: string; ciphertext: string };
};
export type OrgRosterBlob = { iv: string; ciphertext: string };

/**
 * Wraps `orgKey` under a brand-new Enrollment Secret. Used at org creation and
 * on every key rotation. The returned `secret` is shown to the owner once and
 * shared out-of-band; only `enrollment` is sent to the server.
 */
export async function createOrgEnrollment(orgKey: Uint8Array): Promise<{
  secret: string;
  enrollment: OrgEnrollmentBlob;
}> {
  const secret = vaultCrypto.generateEnrollmentSecret();
  const enrollment = await vaultCrypto.wrapOrgKeyWithEnrollmentSecret(orgKey, secret);
  return { secret, enrollment };
}

/** Recovers the Org Key from the server's OES-wrapped blob using a typed-in secret. */
export async function openOrgKeyWithSecret(
  secret: string,
  enrollment: OrgEnrollmentBlob,
): Promise<Uint8Array> {
  return vaultCrypto.openOrgKeyWithEnrollmentSecret(secret, enrollment);
}

export const {
  formatEnrollmentSecret,
  normalizeEnrollmentSecret,
  emptyRoster,
  fingerprintPublicKey,
  formatFingerprint,
  verifyAgainstRoster,
  withEntry: rosterWithEntry,
  withoutEntries: rosterWithoutEntries,
} = vaultCrypto;

export async function encryptRoster(
  orgKey: Uint8Array,
  roster: vaultCrypto.OrgRoster,
): Promise<OrgRosterBlob> {
  return vaultCrypto.encryptRoster(orgKey, roster);
}

export async function decryptRoster(
  orgKey: Uint8Array,
  blob: OrgRosterBlob,
): Promise<vaultCrypto.OrgRoster> {
  return vaultCrypto.decryptRoster(orgKey, blob);
}

/** Fails closed if the stored public key isn't the counterpart of our private key. */
export async function assertKeyPairConsistent(privateKey: Uint8Array, publicKey: string) {
  return vaultCrypto.assertKeyPairConsistent(privateKey, publicKey);
}

export async function encryptFile(projectKey: Uint8Array, plaintext: Uint8Array) {
  const contentId = newId();
  const payload = await vaultCrypto.encryptFileContent(projectKey, contentId, plaintext);
  const plaintextFingerprint = await vaultCrypto.fileFingerprintHex(projectKey, plaintext);
  return { contentId, payload, plaintextSize: plaintext.length, plaintextFingerprint };
}

export async function decryptFile(
  projectKey: Uint8Array,
  payload: EncryptedFilePayload & { contentId: string },
): Promise<Uint8Array> {
  return vaultCrypto.decryptFileContent(projectKey, payload.contentId, payload);
}

export const { bytesToUtf8, utf8ToBytes, DecryptionError } = vaultCrypto;
