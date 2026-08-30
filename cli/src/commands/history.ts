import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import type { FileDto, FileVersionSummaryDto } from "../lib/types";

export interface HistoryOptions {
  project?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function historyCommand(filename: string, options: HistoryOptions): Promise<void> {
  const project = await resolveProject(options.project);
  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);
  const file = files.find((f) => f.filename === filename);
  if (!file) throw new Error(`No file named "${filename}" in project "${project.name}".`);

  const { versions, capped, limit } = await apiRequest<{
    versions: FileVersionSummaryDto[];
    capped?: boolean;
    limit?: number | null;
  }>(`/projects/${project.id}/files/${file.id}/versions`);

  console.log(`${filename}\n`);
  for (const v of versions) {
    console.log(`v${v.versionNumber}   ${formatDate(v.createdAt)}${v.isCurrent ? "   current" : ""}`);
  }
  if (capped) {
    console.log(
      `\nFree keeps the last ${limit ?? 2} versions of each file — upgrade to Pro for full history.`,
    );
  }
}
