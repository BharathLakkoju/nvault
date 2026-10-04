import { Command } from "commander";
import { createRequire } from "node:module";
import { join } from "node:path";
import { readCliVersion } from "./lib/version";

const requireFromHere = createRequire(__filename);
const pkg = requireFromHere(join(__dirname, "..", "package.json")) as { version: string };

describe("nvault --version", () => {
  it("uses the version from package.json (same as --version output)", () => {
    const program = new Command();
    program.version(readCliVersion());

    expect(program.version()).toBe(pkg.version);
    expect(readCliVersion()).toBe(pkg.version);
  });
});
