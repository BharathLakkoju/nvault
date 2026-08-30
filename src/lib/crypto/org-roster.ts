import { aeadDecrypt, aeadEncrypt, DecryptionError } from "./aead";
import { base64ToBytes, bytesToBase64, utf8ToBytes } from "./encoding";
import type { WrappedKey } from "./envelope";
import { sha256Hex } from "./hash";

/**
 * Encrypted member roster.
 *
 * Key rotation re-wraps the new Org Key to every active member's public key.
 * Those public keys are served by the API, so a malicious server could hand
 * the rotating admin a substituted key and capture the new Org Key. The
 * roster defeats that: each member records a fingerprint of THEIR OWN public
 * key (from their local keypair) as they enroll, into a blob encrypted under
 * the Org Key. Before every rotation the admin's client recomputes each
 * served key's fingerprint and aborts on any mismatch.
 *
 * The blob is authenticated (AES-256-GCM, AAD "org-roster") so the server —
 * which does not hold the Org Key — cannot forge or edit entries. It can only
 * withhold the blob (a detectable denial of service) or serve a stale copy;
 * `version` is a monotonic counter the server enforces on write and the
 * client sanity-checks on read. Cross-org substitution is already prevented
 * by the per-org Org Key, so the AAD carries no org identifier (the org id is
 * server-assigned and unknown to the client when it seeds the roster).
 */

export interface RosterEntry {
  /** Hex SHA-256 of the member's SPKI public key. */
  fingerprint: string;
  addedAt: string; // ISO
}

export interface OrgRoster {
  version: number;
  /**
   * Keyed by userId (stable, and known before the membership row exists so
   * the org creator can seed the roster with their own entry).
   */
  entries: Record<string, RosterEntry>;
}

export interface RosterCiphertext {
  iv: string;
  ciphertext: string;
}

const AAD = utf8ToBytes("org-roster");

export function emptyRoster(): OrgRoster {
  return { version: 0, entries: {} };
}

/** Hex SHA-256 fingerprint of an SPKI public key (base64). */
export function fingerprintPublicKey(spkiBase64: string): Promise<string> {
  return sha256Hex(base64ToBytes(spkiBase64));
}

/** Human-readable grouping of a hex fingerprint for out-of-band verification. */
export function formatFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{1,4}/g) ?? []).join(" ");
}

export async function encryptRoster(
  orgKey: Uint8Array,
  roster: OrgRoster,
): Promise<RosterCiphertext> {
  const { iv, ciphertext } = await aeadEncrypt(orgKey, utf8ToBytes(JSON.stringify(roster)), AAD);
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

export async function decryptRoster(
  orgKey: Uint8Array,
  blob: RosterCiphertext,
): Promise<OrgRoster> {
  const plaintext = await aeadDecrypt(
    orgKey,
    base64ToBytes(blob.iv),
    base64ToBytes(blob.ciphertext),
    AAD,
  );
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as OrgRoster;
  if (typeof parsed?.version !== "number" || typeof parsed?.entries !== "object") {
    throw new DecryptionError("Roster is malformed.");
  }
  return parsed;
}

/** Returns a copy of `roster` (version bumped) with `userId`'s entry set. */
export function withEntry(roster: OrgRoster, userId: string, entry: RosterEntry): OrgRoster {
  return {
    version: roster.version + 1,
    entries: { ...roster.entries, [userId]: entry },
  };
}

/** Returns a copy of `roster` (version bumped) with the listed users removed. */
export function withoutEntries(roster: OrgRoster, userIds: string[]): OrgRoster {
  const entries = { ...roster.entries };
  for (const id of userIds) delete entries[id];
  return { version: roster.version + 1, entries };
}

export interface KeyMismatch {
  userId: string;
}

/**
 * Checks a set of {userId, servedPublicKey} against the roster. Returns the
 * entries whose served key does not match the pinned fingerprint (a possible
 * server-side key substitution) and the ones with no pin yet.
 */
export async function verifyAgainstRoster(
  roster: OrgRoster,
  members: { userId: string; publicKey: string }[],
): Promise<{ mismatched: KeyMismatch[]; unpinned: KeyMismatch[] }> {
  const mismatched: KeyMismatch[] = [];
  const unpinned: KeyMismatch[] = [];
  for (const m of members) {
    const pin = roster.entries[m.userId];
    if (!pin) {
      unpinned.push({ userId: m.userId });
      continue;
    }
    const fpr = await fingerprintPublicKey(m.publicKey);
    if (fpr !== pin.fingerprint) {
      mismatched.push({ userId: m.userId });
    }
  }
  return { mismatched, unpinned };
}

export { DecryptionError };
