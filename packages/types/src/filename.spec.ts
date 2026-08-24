import { assertSafeFilename, InvalidFilenameError, isSafeFilename, isDotenvStyleFile } from "./filename";

describe("assertSafeFilename", () => {
  it("accepts common dotenv-style filenames", () => {
    for (const name of [".env", ".env.local", ".env.development", ".env.production", "secrets.json"]) {
      expect(assertSafeFilename(name)).toBe(name);
    }
  });

  const NUL = String.fromCharCode(0);

  const rejectedCases: Array<[string, string]> = [
    ["", "empty"],
    ["..", "dot-dot"],
    [".", "single dot"],
    ["../../etc/passwd", "path traversal with separators"],
    ["..%2f..%2fetc%2fpasswd", "encoded traversal (rejected by charset, not decoding)"],
    ["a/b", "forward slash"],
    ["a\\b", "backslash"],
    ["..env", "contains '..' substring"],
    [`a${NUL}b`, "embedded NUL byte"],
    ["a\nb", "embedded newline"],
    ["a".repeat(256), "over max length"],
    ["résumé.env", "non-ASCII characters"],
  ];

  it.each(rejectedCases)("rejects %j (%s)", (name) => {
    expect(() => assertSafeFilename(name)).toThrow(InvalidFilenameError);
    expect(isSafeFilename(name)).toBe(false);
  });
});

describe("isDotenvStyleFile", () => {
  it("recognizes .env and its variants", () => {
    expect(isDotenvStyleFile(".env")).toBe(true);
    expect(isDotenvStyleFile(".env.local")).toBe(true);
    expect(isDotenvStyleFile(".ENV.PRODUCTION")).toBe(true);
  });

  it("does not treat arbitrary config files as dotenv-style", () => {
    expect(isDotenvStyleFile("secrets.json")).toBe(false);
    expect(isDotenvStyleFile("config.yaml")).toBe(false);
  });
});
