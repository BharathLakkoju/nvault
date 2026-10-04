import { createRequire } from "node:module";
import { join } from "node:path";
import { readCliVersion } from "./version";

const requireFromHere = createRequire(__filename);
const pkg = requireFromHere(join(__dirname, "..", "..", "package.json")) as { version: string };

describe("readCliVersion", () => {
  it("matches cli/package.json", () => {
    expect(readCliVersion()).toBe(pkg.version);
  });
});
