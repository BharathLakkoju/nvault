import { RotateKeyRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { requireStepUp } from "@/server/auth/webauthn";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, json, readJson } from "@/server/http";
import { rotateKey } from "@/server/organizations/rotation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await requireStepUp(auth.userId, auth.sessionId);
  const actor = await authorizeOrg(auth.userId, params.id, "ADMIN");
  const dto = await readJson(req, RotateKeyRequestSchema);
  const result = await rotateKey(params.id, actor, dto);
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.key_rotated",
    targetType: "organization",
    targetId: params.id,
    metadata: {
      epoch: result.epoch,
      projects: dto.projectKeys.length,
      members: dto.memberKeys.length,
    },
    ipAddress: clientIp(req),
  });
  return json({ epoch: result.epoch });
});
