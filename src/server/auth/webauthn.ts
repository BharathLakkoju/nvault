import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db";
import { appOrigin, env } from "../env";
import { ApiError } from "../http";

const STEP_UP_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_TTL_SECONDS = 300;

function rpId(): string {
  return new URL(appOrigin()).hostname;
}

function rpName(): string {
  return "nvault";
}

function challengeSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

async function issueChallengeToken(
  userId: string,
  challenge: string,
  purpose: "webauthn-register" | "webauthn-step-up",
): Promise<string> {
  return new SignJWT({ challenge, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(challengeSecret());
}

async function consumeChallengeToken(
  userId: string,
  challengeToken: string,
  purpose: "webauthn-register" | "webauthn-step-up",
): Promise<string> {
  let payload: { challenge?: string; purpose?: string; sub?: string };
  try {
    const verified = await jwtVerify(challengeToken, challengeSecret());
    payload = verified.payload as typeof payload;
  } catch {
    throw new ApiError(400, "Passkey challenge expired — try again.");
  }
  if (payload.sub !== userId || payload.purpose !== purpose || typeof payload.challenge !== "string") {
    throw new ApiError(400, "Invalid passkey challenge.");
  }
  return payload.challenge;
}

export async function userHasPasskeys(userId: string): Promise<boolean> {
  const count = await db.webAuthnCredential.count({ where: { userId } });
  return count > 0;
}

export async function listPasskeys(userId: string) {
  return db.webAuthnCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
}

export async function deletePasskey(userId: string, credentialRowId: string): Promise<void> {
  const row = await db.webAuthnCredential.findUnique({ where: { id: credentialRowId } });
  if (!row || row.userId !== userId) return;
  await db.webAuthnCredential.delete({ where: { id: credentialRowId } });
}

export async function beginPasskeyRegistration(userId: string) {
  const existing = await db.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpId(),
    userName: userId,
    userDisplayName: userId,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports?.split(",") as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  const challengeToken = await issueChallengeToken(userId, options.challenge, "webauthn-register");
  return { options, challengeToken };
}

export async function finishPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  challengeToken: string,
) {
  const expectedChallenge = await consumeChallengeToken(userId, challengeToken, "webauthn-register");
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: appOrigin(),
    expectedRPID: rpId(),
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(400, "Passkey registration could not be verified.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await db.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports?.join(",") ?? null,
    },
  });
}

export async function beginPasskeyStepUp(userId: string) {
  const credentials = await db.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });
  if (credentials.length === 0) {
    throw new ApiError(409, "Register a passkey in Settings before this action.");
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports?.split(",") as AuthenticatorTransportFuture[] | undefined,
    })),
    userVerification: "required",
  });

  const challengeToken = await issueChallengeToken(userId, options.challenge, "webauthn-step-up");
  return { options, challengeToken };
}

export async function finishPasskeyStepUp(
  userId: string,
  sessionId: string,
  response: AuthenticationResponseJSON,
  challengeToken: string,
) {
  const expectedChallenge = await consumeChallengeToken(userId, challengeToken, "webauthn-step-up");
  const credentialRow = await db.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
  });
  if (!credentialRow || credentialRow.userId !== userId) {
    throw new ApiError(400, "Unknown passkey.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: appOrigin(),
    expectedRPID: rpId(),
    requireUserVerification: true,
    credential: {
      id: credentialRow.credentialId,
      publicKey: Buffer.from(credentialRow.publicKey, "base64url"),
      counter: Number(credentialRow.counter),
      transports: credentialRow.transports?.split(",") as AuthenticatorTransportFuture[] | undefined,
    },
  });
  if (!verification.verified) {
    throw new ApiError(400, "Passkey verification failed.");
  }

  await db.$transaction([
    db.webAuthnCredential.update({
      where: { id: credentialRow.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    }),
    db.session.update({
      where: { id: sessionId },
      data: { stepUpVerifiedAt: new Date() },
    }),
  ]);
}

/** Requires a recent passkey step-up when the user has registered passkeys. */
export async function requireStepUp(userId: string, sessionId: string): Promise<void> {
  if (!(await userHasPasskeys(userId))) return;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { stepUpVerifiedAt: true },
  });
  if (!session?.stepUpVerifiedAt) {
    throw new ApiError(403, "Passkey verification required for this action.");
  }
  if (Date.now() - session.stepUpVerifiedAt.getTime() > STEP_UP_TTL_MS) {
    throw new ApiError(403, "Passkey verification expired — verify again.");
  }
}
