import { sameIdSet } from "./same-id-set";

describe("sameIdSet", () => {
  it("accepts matching sets regardless of order", () => {
    expect(sameIdSet(["b", "a", "c"], ["c", "b", "a"])).toBe(true);
  });

  it("rejects when a real id is missing from the payload", () => {
    expect(sameIdSet(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("rejects duplicate ids in the expected set", () => {
    expect(sameIdSet(["a", "a"], ["a", "b"])).toBe(false);
  });

  it("rejects duplicate ids in the submitted set", () => {
    expect(sameIdSet(["a", "b"], ["a", "a"])).toBe(false);
  });

  it("rejects when duplicates mask a missing id", () => {
    expect(sameIdSet(["a", "b"], ["a", "a"])).toBe(false);
  });
});
