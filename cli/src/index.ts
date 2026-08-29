#!/usr/bin/env node
import { Command } from "commander";
import { color } from "./lib/colors";
import { NotLoggedInError, ApiError } from "./lib/api-client";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { whoamiCommand } from "./commands/whoami";
import { projectsCommand } from "./commands/projects";
import { projectCreateCommand, projectDeleteCommand } from "./commands/project";
import { filesCommand } from "./commands/files";
import { pushCommand } from "./commands/push";
import { pullCommand } from "./commands/pull";
import { initCommand } from "./commands/init";
import { deleteCommand } from "./commands/delete";
import { historyCommand } from "./commands/history";
import { restoreCommand } from "./commands/restore";
import { statusCommand } from "./commands/status";
import { runCommand } from "./commands/run";

const program = new Command();

program
  .name("nvault")
  .description("Your development environment, available anywhere.")
  .version("0.1.0");

program
  .command("login")
  .description("Authenticate this machine with a Personal Access Token")
  .option("-t, --token <token>", "Access token from Settings → CLI Tokens (evk_…)")
  .option("--api-url <url>", "Your nvault server URL (e.g. https://vault.example.com)")
  .action(loginCommand);
program.command("logout").description("Remove this machine's stored credentials").action(logoutCommand);
program.command("whoami").description("Show the currently logged-in account").action(whoamiCommand);

program.command("projects").description("List your projects").action(projectsCommand);

const project = program.command("project").description("Manage projects");
project
  .command("create <name>")
  .description("Create a new project")
  .action(projectCreateCommand);
project
  .command("delete <name>")
  .description("Delete a project and all its files")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(projectDeleteCommand);

program
  .command("init")
  .description("Detect this repository's nvault project and restore its environment files")
  .action(initCommand);

program
  .command("status")
  .description("Compare local environment files against what's stored (git-remote detected)")
  .action(statusCommand);

program
  .command("files [project]")
  .description("List files in a project (auto-detected from git remote if omitted)")
  .action(filesCommand);

program
  .command("push [project] [file]")
  .description("Upload environment file(s) to a project")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(pushCommand);

program
  .command("pull [project] [file]")
  .description("Download environment file(s) from a project")
  .option("-y, --yes", "Overwrite local files without prompting")
  .action(pullCommand);

program
  .command("delete <project> <file>")
  .description("Delete a file and all its version history")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(deleteCommand);

program
  .command("history <file>")
  .description("Show version history for a file")
  .option("-p, --project <name>", "Project name (auto-detected from git remote if omitted)")
  .action(historyCommand);

program
  .command("restore <file> <version>")
  .description("Restore a previous version of a file (non-destructive — creates a new version)")
  .option("-p, --project <name>", "Project name (auto-detected from git remote if omitted)")
  .action(restoreCommand);

program
  .command("run [project]")
  .description("Run a command with the project's environment injected — nothing is written to disk")
  .allowUnknownOption()
  .action(async (projectName: string | undefined) => {
    const dashIndex = process.argv.indexOf("--");
    const commandParts = dashIndex === -1 ? [] : process.argv.slice(dashIndex + 1);
    await runCommand(projectName, commandParts);
  });

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof NotLoggedInError) {
      console.error(color.red(err.message));
      process.exit(1);
    }
    if (err instanceof ApiError) {
      console.error(color.red(err.message));
      process.exit(1);
    }
    if (err instanceof Error) {
      console.error(color.red(err.message));
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  }
}

void main();
