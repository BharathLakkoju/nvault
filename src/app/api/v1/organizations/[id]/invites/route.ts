import { CreateInviteRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { createInvite, inviteToDto, listPendingInvites } from "@/server/organizations/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeOrg(auth.userId, params.id, "ADMIN", "read");
  const invites = await listPendingInvites(params.id);
  return json({ invites: invites.map(inviteToDto) });
});

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const membership = await authorizeOrg(auth.userId, params.id, "ADMIN");

  const ip = clientIp(req);
  await enforceRateLimit(`org/invite:${params.id}`, { limit: 30, windowMs: 60 * 60_000 });
  await enforceRateLimit(`org/invite-ip:${ip ?? "unknown"}`, { limit: 30, windowMs: 60_000 });

  const dto = await readJson(req, CreateInviteRequestSchema);
  const invite = await createInvite(params.id, membership, dto);

  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.member_invited",
    targetType: "invite",
    targetId: invite.id,
    metadata: { email: invite.email, role: invite.role },
    ipAddress: ip,
  });

  return json(
    {
      // The raw token is returned exactly once. Share the link out-of-band.
      token: invite.token,
      invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt },
    },
    201,
  );
});
