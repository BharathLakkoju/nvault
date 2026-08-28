import { resolveExecutable } from "./which";

describe("resolveExecutable", () => {
  it("returns absolute paths unchanged", () => {
    expect(resolveExecutable("/usr/bin/node")).toBe("/usr/bin/node");
  });

  it("resolves a bare command name (e.g. 'node') to an absolute path on PATH", () => {
    const resolved = resolveExecutable("node");
    expect(resolved).not.toBe("node");
    expect(resolved.startsWith("/") || /^[A-Za-z]:\\/.test(resolved)).toBe(true);
  });

  it("falls back to the original string when nothing on PATH matches", () => {
    expect(resolveExecutable("definitely-not-a-real-binary-xyz")).toBe("definitely-not-a-real-binary-xyz");
  });
});
