import type { User } from "@/generated/prisma/client";
import { db } from "./db";
import type { RegisterRequest } from "@/lib/schemas";

export interface CreateUserInput extends Omit<RegisterRequest, "password"> {
  passwordHash: string;
}

export function findUserByEmail(email: string): Promise<User | null> {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

export function createUser(input: CreateUserInput): Promise<User> {
  return db.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      kdfSalt: input.kdfSalt,
      kdfIterations: input.kdfIterations,
      wrappedMasterKeyIv: input.wrappedMasterKey.iv,
      wrappedMasterKeyCiphertext: input.wrappedMasterKey.ciphertext,
    },
  });
}

export function toPublicProfile(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export function toVaultKeyMaterial(user: User) {
  return {
    kdfSalt: user.kdfSalt,
    kdfIterations: user.kdfIterations,
    wrappedMasterKey: {
      iv: user.wrappedMasterKeyIv,
      ciphertext: user.wrappedMasterKeyCiphertext,
    },
  };
}

/**
 * The user's asymmetric keypair material, or `null` if it has not been
 * provisioned yet (pre-keypair accounts — the client provisions on the next
 * vault unlock). `wrappedPrivateKey` is ciphertext; the server never holds
 * the unwrapped private key.
 */
export function toKeyPairMaterial(user: User) {
  if (
    !user.publicKey ||
    !user.wrappedPrivateKeyIv ||
    !user.wrappedPrivateKeyCiphertext
  ) {
    return null;
  }
  return {
    publicKey: user.publicKey,
    wrappedPrivateKey: {
      iv: user.wrappedPrivateKeyIv,
      ciphertext: user.wrappedPrivateKeyCiphertext,
    },
  };
}

/**
 * Persists a freshly-provisioned keypair. Write-once: refuses if the user
 * already has a `publicKey`, so a stolen session cannot swap the keypair
 * (which would lock the user out of orgs and could enable a grant-key MITM).
 * Returns `false` when a keypair already exists.
 */
export async function setUserKeyPair(
  userId: string,
  input: { publicKey: string; wrappedPrivateKey: { iv: string; ciphertext: string } },
): Promise<boolean> {
  const result = await db.user.updateMany({
    where: { id: userId, publicKey: null },
    data: {
      publicKey: input.publicKey,
      wrappedPrivateKeyIv: input.wrappedPrivateKey.iv,
      wrappedPrivateKeyCiphertext: input.wrappedPrivateKey.ciphertext,
    },
  });
  return result.count === 1;
}
