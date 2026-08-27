import { generateOpaqueToken, hashToken } from "./tokens";

describe("generateOpaqueToken", () => {
  it("generates unique, sufficiently long tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("same-input")).toBe(hashToken("same-input"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("never returns the raw input (not reversible by inspection)", () => {
    expect(hashToken("my-refresh-token")).not.toContain("my-refresh-token");
  });
});
