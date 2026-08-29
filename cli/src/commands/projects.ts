import { apiRequest } from "../lib/api-client";
import type { ProjectDto } from "../lib/types";

export async function projectsCommand(): Promise<void> {
  const { projects } = await apiRequest<{ projects: ProjectDto[] }>("/projects");
  if (projects.length === 0) {
    console.log("No projects yet. Create one from the web app first.");
    return;
  }

  const groups: Array<{ label: string; items: ProjectDto[] }> = [];
  const personal = projects.filter((p) => !p.organizationId);
  if (personal.length > 0) groups.push({ label: "Personal", items: personal });

  const orgNames = [
    ...new Set(projects.filter((p) => p.organizationId).map((p) => p.organizationName ?? "Organization")),
  ];
  for (const name of orgNames) {
    groups.push({ label: name, items: projects.filter((p) => p.organizationName === name) });
  }

  groups.forEach((group, gi) => {
    if (gi > 0) console.log();
    console.log(`${group.label}\n`);
    group.items.forEach((p, i) => {
      const count = p.fileCount ?? 0;
      console.log(`  ${i + 1}. ${p.name}  (${count} file${count === 1 ? "" : "s"})`);
    });
  });
}
