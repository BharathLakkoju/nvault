import type { LoginRequest, RegisterRequest } from "@/lib/schemas";
import { audit } from "../audit";
import { ApiError } from "../http";
import {
  createUser,
  findUserByEmail,
  findUserById,
  toKeyPairMaterial,
  toPublicProfile,
  toVaultKeyMaterial,
} from "../users";
import { hashPassword, verifyPassword } from "./password";
import { createSession, revokeSession } from "./session";
import type { IssuedTokens } from "./tokens";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  tokens: IssuedTokens;
  user: ReturnType<typeof toPublicProfile>;
  vaultKeyMaterial: ReturnType<typeof toVaultKeyMaterial>;
  keyPairMaterial: ReturnType<typeof toKeyPairMaterial>;
}

export async function register(dto: RegisterRequest, meta: RequestMeta): Promise<AuthResult> {
  const existing = await findUserByEmail(dto.email);
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await hashPassword(dto.password);
  const user = await createUser({ ...dto, passwordHash });

  const tokens = await createSession(user.id, {
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  await audit({
    userId: user.id,
    action: "auth.register",
    targetType: "user",
    targetId: user.id,
    ipAddress: meta.ipAddress,
  });

  return {
    tokens,
    user: toPublicProfile(user),
    vaultKeyMaterial: toVaultKeyMaterial(user),
    keyPairMaterial: toKeyPairMaterial(user),
  };
}

export async function login(dto: LoginRequest, meta: RequestMeta): Promise<AuthResult> {
  const user = await findUserByEmail(dto.email);
  const genericError = "Invalid email or password";

  if (!user) {
    // Burn comparable time so login timing does not reveal whether the email exists.
    await hashPassword(dto.password).catch(() => undefined);
    await audit({ action: "auth.login_failed", ipAddress: meta.ipAddress });
    throw new ApiError(401, genericError);
  }

  const valid = await verifyPassword(user.passwordHash, dto.password);
  if (!valid) {
    await audit({ userId: user.id, action: "auth.login_failed", ipAddress: meta.ipAddress });
    throw new ApiError(401, genericError);
  }

  const tokens = await createSession(user.id, {
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  await audit({ userId: user.id, action: "auth.login", ipAddress: meta.ipAddress });

  return {
    tokens,
    user: toPublicProfile(user),
    vaultKeyMaterial: toVaultKeyMaterial(user),
    keyPairMaterial: toKeyPairMaterial(user),
  };
}

export async function me(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new ApiError(401, "Unauthorized");
  return {
    user: toPublicProfile(user),
    vaultKeyMaterial: toVaultKeyMaterial(user),
    keyPairMaterial: toKeyPairMaterial(user),
  };
}

export async function logout(userId: string, sessionId: string, ipAddress?: string): Promise<void> {
  await revokeSession(userId, sessionId);
  await audit({
    userId,
    action: "auth.logout",
    targetType: "session",
    targetId: sessionId,
    ipAddress,
  });
}
