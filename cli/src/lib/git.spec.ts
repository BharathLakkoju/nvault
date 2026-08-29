import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectGitRemote, isInsideGitRepo } from "./git";

describe("detectGitRemote", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "envvault-git-test-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when there is no origin remote", () => {
    expect(detectGitRemote(dir)).toBeNull();
  });

  it("returns the origin remote URL when one is configured", () => {
    execFileSync("git", ["remote", "add", "origin", "git@github.com:bharath/portfolio.git"], { cwd: dir });
    expect(detectGitRemote(dir)).toBe("git@github.com:bharath/portfolio.git");
  });

  it("returns null outside of a git repository entirely", () => {
    const outside = mkdtempSync(join(tmpdir(), "envvault-not-git-"));
    try {
      expect(detectGitRemote(outside)).toBeNull();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("isInsideGitRepo", () => {
  it("detects a .git directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "envvault-git-test-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: dir });
      expect(isInsideGitRepo(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns false when there is no .git directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "envvault-not-git-"));
    try {
      expect(isInsideGitRepo(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
