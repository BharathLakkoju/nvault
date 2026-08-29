import { apiRequest } from "./api-client";
import { openOrgKey, openProjectKey } from "./vault-client";
import type { OrganizationDetailDto, ProjectDto } from "./types";
import type { VaultSession } from "./vault-session";

/**
 * Resolves the data key for a project, regardless of whether it is personal
 * or organization-scoped.
 *
 * - Personal project: unwrap with the vault master key.
 * - Org project: fetch our member-addressed Organization Key, unwrap it with
 *   our RSA private key, then unwrap the project key with the Org Key.
 */
export async function resolveProjectKey(
  project: ProjectDto,
  session: VaultSession,
): Promise<Uint8Array> {
  if (!project.organizationId) {
    return openProjectKey(session.masterKey, project.id, project.wrappedProjectKey);
  }

  const detail = await apiRequest<OrganizationDetailDto>(
    `/organizations/${project.organizationId}`,
  );
  if (!detail.self.wrappedOrgKey) {
    throw new Error(
      `You don't have key access to "${project.organizationName ?? "this organization"}" yet. Ask an admin to grant you access.`,
    );
  }
  const orgKey = await openOrgKey(session.privateKey, detail.self.wrappedOrgKey);
  return openProjectKey(orgKey, project.id, project.wrappedProjectKey);
}
