import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { audit } from "@/server/audit";
import { WebAuthnRegistrationVerifySchema } from "@/server/auth/dto";
import { requireAuth } from "@/server/auth/require-auth";
import { finishPasskeyRegistration } from "@/server/auth/webauthn";
import { clientIp, handler, json, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, WebAuthnRegistrationVerifySchema);
  await finishPasskeyRegistration(
    auth.userId,
    dto.response as RegistrationResponseJSON,
    dto.challengeToken,
  );
  await audit({
    userId: auth.userId,
    action: "passkey.registered",
    targetType: "user",
    targetId: auth.userId,
    ipAddress: clientIp(req),
  });
  return json({ registered: true }, 201);
});
