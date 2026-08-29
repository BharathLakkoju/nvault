import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db } from "./db";
import { storageEncryptionKey } from "./env";
import { ApiError } from "./http";

/**
 * The only storage backend: encrypted file bytes in Postgres.
 *
 * Defense in depth. The bytes handed to `putObject` are ALREADY the client's
 * zero-knowledge AES-256-GCM ciphertext. Here we wrap them a second time
 * under a server-held key (STORAGE_ENCRYPTION_KEY, never in the database)
 * before persisting. A stolen database dump therefore yields nothing without
 * the Vercel-held key; and even with it, only the client ciphertext, which
 * still requires the user's vault passphrase.
 *
 * Stored layout:  [version:1][iv:12][gcmTag:16][ciphertext:n]
 * The 1-byte version prefix lets the server key be rotated later without a
 * silent format break.
 */
const FORMAT_VERSION = 0x01;
const IV_LEN = 12;
const TAG_LEN = 16;

function seal(key: string, clientCiphertext: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", storageEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(key, "utf8"));
  const enc = Buffer.concat([cipher.update(clientCiphertext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([FORMAT_VERSION]), iv, tag, enc]);
}

function open(key: string, sealed: Buffer): Buffer {
  if (sealed.length < 1 + IV_LEN + TAG_LEN || sealed[0] !== FORMAT_VERSION) {
    throw new ApiError(500, "Stored object is corrupt or in an unknown format");
  }
  const iv = sealed.subarray(1, 1 + IV_LEN);
  const tag = sealed.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const enc = sealed.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", storageEncryptionKey(), iv);
  decipher.setAAD(Buffer.from(key, "utf8"));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  } catch {
    throw new ApiError(500, "Stored object failed integrity verification");
  }
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  // Prisma 7 types `Bytes` columns as `Uint8Array<ArrayBuffer>`; hand it a
  // plain view rather than Node's `Buffer<ArrayBufferLike>`.
  const sealed = new Uint8Array(seal(key, data));
  await db.storageObject.upsert({
    where: { key },
    create: { key, data: sealed },
    update: { data: sealed },
  });
}

export async function getObject(key: string): Promise<Buffer> {
  const row = await db.storageObject.findUnique({ where: { key } });
  if (!row) throw new ApiError(404, "Object not found");
  return open(key, Buffer.from(row.data));
}

export async function deleteObject(key: string): Promise<void> {
  await db.storageObject.deleteMany({ where: { key } });
}
