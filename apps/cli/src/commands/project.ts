import { randomUUID } from "node:crypto";
import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { unlockVaultForThisCommand } from "../lib/vault-session";
import { createWrappedProjectKey } from "../lib/vault-client";
import { promptConfirm } from "../lib/prompt";
import { symbols } from "../lib/colors";
import type { ProjectDto } from "../lib/types";

export async function projectCreateCommand(name: string): Promise<void> {
  const { masterKey } = await unlockVaultForThisCommand();
  const id = randomUUID();
  const { wrappedProjectKey } = await createWrappedProjectKey(masterKey, id);
  const { project } = await apiRequest<{ project: ProjectDto }>("/projects", {
    method: "POST",
    body: { id, name, wrappedProjectKey },
  });
  console.log(`${symbols.check} Created project "${project.name}"`);
}

export async function projectDeleteCommand(name: string, options: { yes?: boolean }): Promise<void> {
  const project = await resolveProject(name);
  if (!options.yes) {
    const confirmed = await promptConfirm(
      `Permanently delete project "${project.name}" and every file in it?`,
    );
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }
  await apiRequest(`/projects/${project.id}`, { method: "DELETE" });
  console.log(`${symbols.check} Deleted project "${project.name}"`);
}
