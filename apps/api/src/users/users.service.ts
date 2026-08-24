import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RegisterRequest } from "@envvault/types";

export interface CreateUserInput extends Omit<RegisterRequest, "password"> {
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
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

  toPublicProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  toVaultKeyMaterial(user: User) {
    return {
      kdfSalt: user.kdfSalt,
      kdfIterations: user.kdfIterations,
      wrappedMasterKey: {
        iv: user.wrappedMasterKeyIv,
        ciphertext: user.wrappedMasterKeyCiphertext,
      },
    };
  }
}
