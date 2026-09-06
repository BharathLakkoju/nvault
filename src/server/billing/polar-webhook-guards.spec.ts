import {
  isStalePolarEvent,
  parsePolarModifiedAt,
  subscriptionIdentityMatches,
} from "./polar-webhook-guards";

describe("parsePolarModifiedAt", () => {
  it("parses ISO strings and rejects invalid values", () => {
    expect(parsePolarModifiedAt("2026-01-02T00:00:00.000Z")?.toISOString()).toBe(
      "2026-01-02T00:00:00.000Z",
    );
    expect(parsePolarModifiedAt("not-a-date")).toBeNull();
  });
});

describe("subscriptionIdentityMatches", () => {
  it("rejects subscription id mismatches once a row is bound", () => {
    expect(
      subscriptionIdentityMatches({ polarSubscriptionId: "sub_a", polarCustomerId: "cus_a" }, {
        id: "sub_b",
        customerId: "cus_a",
      }),
    ).toBe(false);
  });

  it("rejects customer id mismatches once a row is bound", () => {
    expect(
      subscriptionIdentityMatches({ polarSubscriptionId: "sub_a", polarCustomerId: "cus_a" }, {
        id: "sub_a",
        customerId: "cus_b",
      }),
    ).toBe(false);
  });
});

describe("isStalePolarEvent", () => {
  it("ignores events that are not newer than the stored modified_at", () => {
    const stored = new Date("2026-02-01T00:00:00.000Z");
    const older = new Date("2026-01-01T00:00:00.000Z");
    expect(isStalePolarEvent(stored, older)).toBe(true);
    expect(isStalePolarEvent(stored, stored)).toBe(true);
    expect(isStalePolarEvent(stored, new Date("2026-03-01T00:00:00.000Z"))).toBe(false);
  });
});
