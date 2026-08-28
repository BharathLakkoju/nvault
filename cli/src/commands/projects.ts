import { apiRequest } from "../lib/api-client";
import type { ProjectDto } from "../lib/types";

export async function projectsCommand(): Promise<void> {
  const { projects } = await apiRequest<{ projects: ProjectDto[] }>("/projects");
  if (projects.length === 0) {
    console.log("No projects yet. Create one from the web app first.");
    return;
  }
  console.log("Projects\n");
  projects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}  (${p.fileCount ?? 0} file${p.fileCount === 1 ? "" : "s"})`);
  });
}
