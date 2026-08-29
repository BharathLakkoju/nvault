import { mapPolarStatus, statusGrantsEntitlement } from "./service";

describe("mapPolarStatus", () => {
  it("maps active / trialing to ACTIVE + ACTIVE", () => {
    for (const s of ["active", "trialing"]) {
      expect(mapPolarStatus(s)).toEqual({
        subscription: "ACTIVE",
        org: "ACTIVE",
        audit: "billing.subscription_activated",
      });
    }
  });

  it("maps past_due to PAST_DUE + SUSPENDED", () => {
    expect(mapPolarStatus("past_due")).toEqual({
      subscription: "PAST_DUE",
      org: "SUSPENDED",
      audit: "billing.subscription_past_due",
    });
  });

  it("maps canceled / unpaid / paused / incomplete_expired to CANCELED + SUSPENDED", () => {
    for (const s of ["canceled", "unpaid", "paused", "incomplete_expired"]) {
      expect(mapPolarStatus(s)).toEqual({
        subscription: "CANCELED",
        org: "SUSPENDED",
        audit: "billing.subscription_canceled",
      });
    }
  });

  it("leaves an unfinished (incomplete / unknown) checkout at PENDING with no audit", () => {
    for (const s of ["incomplete", "something_new"]) {
      expect(mapPolarStatus(s)).toEqual({
        subscription: "PENDING",
        org: "PENDING_PAYMENT",
        audit: null,
      });
    }
  });
});

describe("statusGrantsEntitlement", () => {
  it("grants access while ACTIVE or PAST_DUE (dunning grace), not otherwise", () => {
    expect(statusGrantsEntitlement("ACTIVE")).toBe(true);
    expect(statusGrantsEntitlement("PAST_DUE")).toBe(true);
    expect(statusGrantsEntitlement("PENDING")).toBe(false);
    expect(statusGrantsEntitlement("CANCELED")).toBe(false);
  });
});
