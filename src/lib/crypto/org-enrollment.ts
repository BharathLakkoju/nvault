import { DecryptionError } from "./aead";
import { base64ToBytes, bytesToBase64 } from "./encoding";
import { unwrapKey, wrapKey, type WrappedKey } from "./envelope";
import { deriveKekFromBytes, DEFAULT_KDF_ITERATIONS } from "./kdf";
import { generateDataKey, generateSalt, randomBytes } from "./random";

/**
 * Organization Enrollment Secret (OES).
 *
 * Personal vaults are unlocked with a user-chosen passphrase. Organizations
 * instead get a machine-generated 128-bit secret, shown to the creator ONCE
 * and shared with each invitee out-of-band (in person, Signal, a password
 * manager share — deliberately NOT the same channel as the invite link).
 *
 * The Organization Key is wrapped under a KEK derived from the OES and stored
 * server-side as ciphertext (Organization.enrollmentWrappedOrgKey*). A new
 * member obtains the Org Key by entering the OES — the server never sees the
 * secret and plays no part in key delivery, so a malicious server cannot add
 * itself as a reader. Because the OES carries full entropy, a leaked DB dump
 * does not expose the Org Key to feasible brute force either.
 *
 * The OES is regenerated on every key rotation; existing members are
 * unaffected (they hold their own wrapped copy of the Org Key).
 */

const OES_BYTES = 16; // 128-bit

// Crockford base32: no I, L, O, U — chosen so the code survives being read
// aloud, typed, or copied out of a chat message.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const AAD = "org-enrollment";

export interface EnrollmentWrap {
  kdfSalt: string; // base64
  kdfIterations: number;
  wrappedOrgKey: WrappedKey;
}

/** A fresh 128-bit enrollment secret, formatted for display (grouped, dashed). */
export function generateEnrollmentSecret(): string {
  return formatEnrollmentSecret(base32Encode(randomBytes(OES_BYTES)));
}

/** Inserts dashes every 4 characters for readability. Purely cosmetic. */
export function formatEnrollmentSecret(secret: string): string {
  return normalizeEnrollmentSecret(secret).replace(/(.{4})(?=.)/g, "$1-");
}

/**
 * Canonicalises user input: upper-cases, strips separators/whitespace, and
 * maps the glyphs Crockford treats as aliases (I/L -> 1, O -> 0). Does not
 * validate — callers that need bytes go through {@link parseEnrollmentSecret}.
 */
export function normalizeEnrollmentSecret(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export class InvalidEnrollmentSecret extends Error {
  constructor(message = "That doesn't look like a valid enrollment secret.") {
    super(message);
    this.name = "InvalidEnrollmentSecret";
  }
}

/** Decodes a (possibly dash-formatted) secret to its 16 raw bytes. */
export function parseEnrollmentSecret(input: string): Uint8Array {
  const normalized = normalizeEnrollmentSecret(input);
  const expectedChars = Math.ceil((OES_BYTES * 8) / 5); // 26
  if (normalized.length !== expectedChars || !/^[0-9A-Z]+$/.test(normalized)) {
    throw new InvalidEnrollmentSecret();
  }
  for (const ch of normalized) {
    if (!ALPHABET.includes(ch)) throw new InvalidEnrollmentSecret();
  }
  return base32Decode(normalized, OES_BYTES);
}

/** Generates a brand-new Org Key and returns it alongside its OES-wrapped form. */
export async function createEnrollmentWrappedOrgKey(secret: string): Promise<{
  orgKey: Uint8Array;
  wrap: EnrollmentWrap;
}> {
  const orgKey = generateDataKey();
  const wrap = await wrapOrgKeyWithEnrollmentSecret(orgKey, secret);
  return { orgKey, wrap };
}

/** Wraps an EXISTING Org Key under a KEK derived from `secret` (used on rotation). */
export async function wrapOrgKeyWithEnrollmentSecret(
  orgKey: Uint8Array,
  secret: string,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<EnrollmentWrap> {
  const salt = generateSalt();
  const kek = await deriveKekFromBytes(parseEnrollmentSecret(secret), salt, iterations);
  const wrappedOrgKey = await wrapKey(kek, orgKey, AAD);
  return { kdfSalt: bytesToBase64(salt), kdfIterations: iterations, wrappedOrgKey };
}

/**
 * Recovers the Org Key from its OES-wrapped form. Throws
 * {@link DecryptionError} when the secret is wrong (the AEAD tag is the only
 * verifier — there is no separate check value, so the server cannot test a
 * candidate secret on its own).
 */
export async function openOrgKeyWithEnrollmentSecret(
  secret: string,
  wrap: EnrollmentWrap,
): Promise<Uint8Array> {
  const kek = await deriveKekFromBytes(
    parseEnrollmentSecret(secret),
    base64ToBytes(wrap.kdfSalt),
    wrap.kdfIterations,
  );
  return unwrapKey(kek, wrap.wrappedOrgKey, AAD);
}

export { DecryptionError };

// --- base32 (Crockford, no checksum) -------------------------------------

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string, byteLength: number): Uint8Array {
  const out = new Uint8Array(byteLength);
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const ch of text) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      if (index < byteLength) out[index++] = (value >>> bits) & 0xff;
    }
  }
  return out;
}
