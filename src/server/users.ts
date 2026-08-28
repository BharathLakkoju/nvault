import type { User } from "@prisma/client";
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
