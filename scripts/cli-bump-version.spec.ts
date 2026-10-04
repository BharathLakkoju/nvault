import { execFileSync } from "node:child_process";

const NODE = process.execPath;
const SCRIPT = "scripts/cli-bump-version.ts";
const NODE_ARGS = ["--experimental-strip-types", SCRIPT];

function runCli(...args: string[]): string {
  return execFileSync(NODE, [...NODE_ARGS, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  }).trim();
}

function runCliFail(...args: string[]): string {
  try {
    execFileSync(NODE, [...NODE_ARGS, ...args], { encoding: "utf8" });
    throw new Error("expected command to fail");
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return (e.stderr ?? e.message ?? String(err)).trim();
  }
}

describe("cli-bump-version CLI", () => {
  it("resolves patch bump", () => {
    expect(runCli("resolve", "--current", "0.1.2", "--bump", "patch")).toBe(
      "0.1.3",
    );
  });

  it("resolves minor and major bumps", () => {
    expect(runCli("resolve", "--current", "0.1.2", "--bump", "minor")).toBe(
      "0.2.0",
    );
    expect(runCli("resolve", "--current", "0.1.2", "--bump", "major")).toBe(
      "1.0.0",
    );
  });

  it("accepts version override greater than current", () => {
    expect(
      runCli(
        "resolve",
        "--current",
        "0.1.2",
        "--bump",
        "patch",
        "--version",
        "0.2.0",
      ),
    ).toBe("0.2.0");
  });

  it("rejects override not greater than current", () => {
    const output = runCliFail(
      "resolve",
      "--current",
      "0.2.0",
      "--version",
      "0.2.0",
    );
    expect(output).toMatch(/greater than/);
  });

  it("rejects invalid semver override", () => {
    const output = runCliFail(
      "resolve",
      "--current",
      "0.1.0",
      "--version",
      "not-semver",
    );
    expect(output).toMatch(/not valid semver/i);
  });

  it("dry-run apply does not change package.json", () => {
    const before = runCli("resolve", "--current", "0.1.2", "--bump", "patch");
    const out = runCli("apply", "--dry-run", "--bump", "patch");
    expect(out).toBe(before);
    expect(runCli("resolve", "--current", "0.1.2", "--bump", "patch")).toBe(
      "0.1.3",
    );
  });
});
