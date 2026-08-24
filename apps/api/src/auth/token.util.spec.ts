import { generateOpaqueToken, generateUserCode, hashToken, normalizeUserCode } from "./token.util";

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

describe("generateUserCode", () => {
  it("produces an XXXX-XXXX shaped code without ambiguous characters", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateUserCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });
});

describe("normalizeUserCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeUserCode(" x7kd-29pl ")).toBe("X7KD-29PL");
  });
});
