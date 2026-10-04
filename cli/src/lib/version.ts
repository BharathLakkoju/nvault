import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const requireFromHere = createRequire(__filename);

/** CLI release version from cli/package.json (dist/ and src/ layouts). */
export function readCliVersion(): string {
  const candidates = [join(__dirname, "..", "package.json"), join(__dirname, "..", "..", "package.json")];
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    throw new Error("Could not locate cli/package.json");
  }
  const pkg = requireFromHere(path) as { version: string };
  return pkg.version;
}
