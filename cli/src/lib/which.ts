import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

/**
 * Resolves a command name to an absolute executable path by searching
 * PATH, the way a shell would.
 *
 * This matters specifically for the standalone (`pkg`-built) binary
 * distribution of this CLI: `pkg` patches `child_process.spawn` to
 * intercept any command that is literally the string "node" (or equals
 * the running executable's own path) and reroute it to itself — which
 * breaks `nvault run -- node script.js` by trying to run the packaged
 * CLI's own entry point instead of the user's script. Spawning an
 * *absolute* path bypasses that string-equality check entirely, since it
 * no longer matches "node". Resolving up front also just makes `run`
 * behave more predictably in general (no dependence on the child
 * process's inherited PATH matching this one).
 */
export function resolveExecutable(command: string): string {
  if (isAbsolute(command)) return command;

  const pathDirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];

  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const candidate = join(dir, command + ext);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // not found here, keep searching
      }
    }
  }
  return command; // fall back to the original string; let spawn() surface ENOENT if it's truly missing
}
