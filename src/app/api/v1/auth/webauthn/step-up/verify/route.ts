import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { audit } from "@/server/audit";
import { WebAuthnStepUpVerifySchema } from "@/server/auth/dto";
import { requireAuth } from "@/server/auth/require-auth";
import { finishPasskeyStepUp } from "@/server/auth/webauthn";
import { clientIp, handler, json, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, WebAuthnStepUpVerifySchema);
  await finishPasskeyStepUp(
    auth.userId,
    auth.sessionId,
    dto.response as AuthenticationResponseJSON,
    dto.challengeToken,
  );
  await audit({
    userId: auth.userId,
    action: "passkey.step_up",
    targetType: "session",
    targetId: auth.sessionId,
    ipAddress: clientIp(req),
  });
  return json({ verified: true });
});
