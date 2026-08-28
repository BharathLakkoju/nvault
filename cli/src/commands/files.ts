import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import type { FileDto } from "../lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export async function filesCommand(projectName?: string): Promise<void> {
  const project = await resolveProject(projectName);
  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);

  console.log(`${project.name}\n`);
  if (files.length === 0) {
    console.log("No files yet.");
    return;
  }
  for (const file of files) {
    const v = file.currentVersion;
    console.log(`  ${file.filename}${v ? `  v${v.versionNumber}  ${formatBytes(v.plaintextSize)}` : ""}`);
  }
}
