import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { promptConfirm } from "../lib/prompt";
import { symbols } from "../lib/colors";
import type { FileDto } from "../lib/types";

export interface DeleteOptions {
  yes?: boolean;
}

export async function deleteCommand(projectName: string, filename: string, options: DeleteOptions): Promise<void> {
  const project = await resolveProject(projectName);
  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);
  const file = files.find((f) => f.filename === filename);
  if (!file) {
    throw new Error(`No file named "${filename}" in project "${project.name}".`);
  }

  if (!options.yes) {
    const confirmed = await promptConfirm(
      `Permanently delete "${filename}" and all of its version history from "${project.name}"?`,
    );
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  await apiRequest(`/projects/${project.id}/files/${file.id}`, { method: "DELETE" });
  console.log(`${symbols.check} Deleted ${filename}`);
}
