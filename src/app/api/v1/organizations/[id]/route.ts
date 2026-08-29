import { UpdateOrganizationRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, json, noContent, readJson } from "@/server/http";
import {
  deleteOrganization,
  getOrganizationForMember,
  membershipToDto,
  organizationToDto,
  renameOrganization,
} from "@/server/organizations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { org, self } = await getOrganizationForMember(auth.userId, params.id);
  return json({
    organization: {
      ...organizationToDto(org),
      projectCount: org._count.projects,
    },
    self: {
      membershipId: self.id,
      role: self.role,
      status: self.status,
      // The caller's own wrapped Org Key — null until an admin grants it.
      wrappedOrgKey: self.wrappedOrgKeyCiphertext,
      keyEpoch: self.keyEpoch,
    },
    members: org.memberships.map(membershipToDto),
  });
});

export const PATCH = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeOrg(auth.userId, params.id, "ADMIN");
  const dto = await readJson(req, UpdateOrganizationRequestSchema);
  const org = await renameOrganization(params.id, dto);
  await audit({
    userId: auth.userId,
    organizationId: org.id,
    action: "org.renamed",
    targetType: "organization",
    targetId: org.id,
    metadata: { name: org.name, slug: org.slug },
    ipAddress: clientIp(req),
  });
  return json({ organization: organizationToDto(org) });
});

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeOrg(auth.userId, params.id, "OWNER");
  // Audit before the delete: the audit row's organizationId FK cannot
  // reference a row that no longer exists.
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.deleted",
    targetType: "organization",
    targetId: params.id,
    ipAddress: clientIp(req),
  });
  await deleteOrganization(params.id);
  return noContent();
});
