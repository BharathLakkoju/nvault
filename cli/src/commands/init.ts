import { apiRequest } from "../lib/api-client";
import { detectGitRemote } from "../lib/git";
import { appendEnvIgnoreRules, isEnvIgnored } from "../lib/gitignore";
import { promptConfirm } from "../lib/prompt";
import { symbols } from "../lib/colors";
import { pullCommand } from "./pull";
import type { ProjectDto } from "../lib/types";

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const remote = detectGitRemote(cwd);

  if (!remote) {
    console.log("No git remote detected in this directory. Run `nvault pull <project>` and specify a project by name instead.");
    return;
  }

  console.log(`Git repository:\n${remote}\n`);

  const { project } = await apiRequest<{ project: ProjectDto | null }>(
    `/projects/by-git-remote?url=${encodeURIComponent(remote)}`,
  );

  if (!project) {
    console.log("No matching nvault project found for this repository.");
    console.log(
      "Link this repository to a project in the web app (Projects → open your project → Git repository).",
    );
    return;
  }

  console.log(`Matching nvault project:\n${project.name}\n`);

  const restore = await promptConfirm("Restore its environment files here?", true);
  if (!restore) return;

  await pullCommand(project.name, undefined, {});

  if (!isEnvIgnored(cwd)) {
    console.log(`\n${symbols.warn} .env is not listed in .gitignore.`);
    const addIgnore = await promptConfirm("Add environment files to .gitignore?", true);
    if (addIgnore) {
      appendEnvIgnoreRules(cwd);
      console.log(`${symbols.check} Updated .gitignore`);
    }
  }

  console.log("\nEnvironment restored successfully.");
}
