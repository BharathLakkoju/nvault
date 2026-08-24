import { parseDotenv } from "./dotenv-parse";

describe("parseDotenv", () => {
  it("parses simple KEY=VALUE pairs", () => {
    expect(parseDotenv("FOO=bar\nBAZ=qux")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores comments and blank lines", () => {
    expect(parseDotenv("# comment\n\nFOO=bar\n  # another\n")).toEqual({ FOO: "bar" });
  });

  it("strips surrounding quotes and unescapes \\n in double-quoted values", () => {
    expect(parseDotenv('FOO="line1\\nline2"')).toEqual({ FOO: "line1\nline2" });
    expect(parseDotenv("FOO='single quoted'")).toEqual({ FOO: "single quoted" });
  });

  it("handles the `export` prefix", () => {
    expect(parseDotenv("export FOO=bar")).toEqual({ FOO: "bar" });
  });

  it("skips lines without a valid identifier key", () => {
    expect(parseDotenv("123FOO=bar\nnot a line\nVALID=ok")).toEqual({ VALID: "ok" });
  });

  it("preserves '=' characters within the value", () => {
    expect(parseDotenv("CONN=key=value&other=1")).toEqual({ CONN: "key=value&other=1" });
  });
});
