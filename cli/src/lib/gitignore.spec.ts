import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEnvIgnoreRules, isEnvIgnored } from "./gitignore";

describe("isEnvIgnored / appendEnvIgnoreRules", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nvault-gitignore-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports not-ignored when there is no .gitignore at all", () => {
    expect(isEnvIgnored(dir)).toBe(false);
  });

  it("reports not-ignored when .gitignore doesn't mention env files", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\ndist\n");
    expect(isEnvIgnored(dir)).toBe(false);
  });

  it("recognizes an existing .env rule", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n.env\n");
    expect(isEnvIgnored(dir)).toBe(true);
  });

  it("appends recommended rules to an existing .gitignore without clobbering it", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n");
    appendEnvIgnoreRules(dir);
    const content = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(content).toContain("node_modules");
    expect(content).toContain(".env");
    expect(isEnvIgnored(dir)).toBe(true);
  });

  it("creates a .gitignore if one doesn't exist yet", () => {
    appendEnvIgnoreRules(dir);
    expect(isEnvIgnored(dir)).toBe(true);
  });
});
