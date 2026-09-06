import { ProvisionKeyPairRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { requireStepUp } from "@/server/auth/webauthn";
import { ApiError, clientIp, handler, json, readJson } from "@/server/http";
import { findUserById, setUserKeyPair, toKeyPairMaterial } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the caller's own keypair material (public key + wrapped private
 * key), or `keyPairMaterial: null` if not provisioned yet. Never exposes any
 * other user's key material — other members' public keys are only surfaced
 * through org-membership endpoints.
 */
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const user = await findUserById(auth.userId);
  if (!user) throw new ApiError(401, "Unauthorized");
  return json({ keyPairMaterial: toKeyPairMaterial(user) });
});

/**
 * Provisions the caller's keypair. Write-once: if a keypair already exists
 * this returns 409 and changes nothing, so a stolen session cannot replace
 * the keypair (which would lock the user out of org projects and could set
 * up a grant-key MITM). The private key is received already wrapped under
 * the user's master key — the server stores ciphertext only.
 */
export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  await requireStepUp(auth.userId, auth.sessionId);
  const dto = await readJson(req, ProvisionKeyPairRequestSchema);

  const stored = await setUserKeyPair(auth.userId, {
    publicKey: dto.publicKey,
    wrappedPrivateKey: dto.wrappedPrivateKey,
  });
  if (!stored) {
    throw new ApiError(409, "A keypair has already been provisioned for this account");
  }

  await audit({
    userId: auth.userId,
    action: "vaultkeypair.provisioned",
    targetType: "user",
    targetId: auth.userId,
    ipAddress: clientIp(req),
  });

  const user = await findUserById(auth.userId);
  return json({ keyPairMaterial: user ? toKeyPairMaterial(user) : null }, 201);
});
