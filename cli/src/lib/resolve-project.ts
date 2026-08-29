import { apiRequest } from "./api-client";
import { detectGitRemote } from "./git";
import { promptText } from "./prompt";
import { color } from "./colors";
import type { ProjectDto } from "./types";

/**
 * Resolves which project a command should operate on, in order of
 * explicitness: an explicit name always wins; otherwise fall back to git
 * remote detection (never required — see resolveProjectInteractively for
 * the no-git, no-argument path).
 */
export async function resolveProject(explicitName?: string): Promise<ProjectDto> {
  const { projects } = await apiRequest<{ projects: ProjectDto[] }>("/projects");

  if (explicitName) {
    const match = projects.find((p) => p.name.toLowerCase() === explicitName.toLowerCase());
    if (!match) {
      throw new Error(`No project named "${explicitName}". Run \`nvault projects\` to see available projects.`);
    }
    return match;
  }

  const remote = detectGitRemote(process.cwd());
  if (remote) {
    const { project } = await apiRequest<{ project: ProjectDto | null }>(
      `/projects/by-git-remote?url=${encodeURIComponent(remote)}`,
    );
    if (project) return project;
  }

  if (projects.length === 0) {
    throw new Error("You don't have any projects yet. Create one from the web app first.");
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      "Couldn't determine which project to use (no matching git remote). Pass a project name explicitly.",
    );
  }

  console.log("\nWhich project?\n");
  projects.forEach((p, i) => console.log(`  ${color.bold(String(i + 1))}. ${p.name}`));
  const answer = await promptText("\nEnter a number: ");
  const index = Number(answer) - 1;
  if (Number.isNaN(index) || index < 0 || index >= projects.length) {
    throw new Error("Invalid selection.");
  }
  return projects[index];
}
