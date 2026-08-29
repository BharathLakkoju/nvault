import { CreateOrganizationRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json, readJson } from "@/server/http";
import {
  createOrganization,
  listOrganizationsForUser,
  organizationToDto,
} from "@/server/organizations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const memberships = await listOrganizationsForUser(auth.userId);
  return json({
    organizations: memberships.map((m) => ({
      ...organizationToDto(m.organization),
      role: m.role,
      status: m.status,
      memberCount: m.organization._count.memberships,
      projectCount: m.organization._count.projects,
    })),
  });
});

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, CreateOrganizationRequestSchema);
  const org = await createOrganization(auth.userId, {
    name: dto.name,
    slug: dto.slug,
    wrappedOrgKeyCiphertext: dto.wrappedOrgKey,
  });
  await audit({
    userId: auth.userId,
    organizationId: org.id,
    action: "org.created",
    targetType: "organization",
    targetId: org.id,
    metadata: { name: org.name, slug: org.slug },
    ipAddress: clientIp(req),
  });
  return json({ organization: organizationToDto(org) }, 201);
});
