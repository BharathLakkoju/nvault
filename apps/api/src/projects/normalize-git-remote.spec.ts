import { normalizeGitRemote } from "./normalize-git-remote";

describe("normalizeGitRemote", () => {
  it("normalizes an SSH remote", () => {
    expect(normalizeGitRemote("git@github.com:bharath/portfolio.git")).toBe("github.com/bharath/portfolio");
  });

  it("normalizes an HTTPS remote", () => {
    expect(normalizeGitRemote("https://github.com/bharath/portfolio.git")).toBe("github.com/bharath/portfolio");
  });

  it("normalizes an HTTPS remote without a trailing .git", () => {
    expect(normalizeGitRemote("https://github.com/bharath/portfolio")).toBe("github.com/bharath/portfolio");
  });

  it("is case-insensitive", () => {
    expect(normalizeGitRemote("https://GitHub.com/Bharath/Portfolio.git")).toBe("github.com/bharath/portfolio");
  });

  it("makes SSH and HTTPS forms of the same repo equal", () => {
    const ssh = normalizeGitRemote("git@github.com:bharath/portfolio.git");
    const https = normalizeGitRemote("https://github.com/bharath/portfolio.git");
    expect(ssh).toBe(https);
  });

  it("returns undefined for undefined input", () => {
    expect(normalizeGitRemote(undefined)).toBeUndefined();
  });
});
