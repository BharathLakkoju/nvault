import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { symbols } from "../lib/colors";
import type { FileDto, FileVersionSummaryDto } from "../lib/types";

export interface RestoreOptions {
  project?: string;
}

export async function restoreCommand(filename: string, version: string, options: RestoreOptions): Promise<void> {
  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error("<version> must be a positive integer, e.g. `nvault restore .env 4`");
  }

  const project = await resolveProject(options.project);
  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);
  const file = files.find((f) => f.filename === filename);
  if (!file) throw new Error(`No file named "${filename}" in project "${project.name}".`);

  const { versions } = await apiRequest<{ versions: FileVersionSummaryDto[] }>(
    `/projects/${project.id}/files/${file.id}/versions`,
  );
  const target = versions.find((v) => v.versionNumber === versionNumber);
  if (!target) throw new Error(`${filename} has no version ${versionNumber}.`);

  const result = await apiRequest<{ version: FileVersionSummaryDto }>(
    `/projects/${project.id}/files/${file.id}/restore`,
    { method: "POST", body: { versionId: target.id } },
  );

  console.log(`${symbols.check} Restored v${versionNumber} as new v${result.version.versionNumber}`);
}
