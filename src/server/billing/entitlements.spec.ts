import { ApiError } from "../http";
import {
  FREE_LIMITS,
  MAX_PROJECTS_PER_ORG,
  TEAM_TIERS,
  assertCanAddOrgMember,
  assertCanCreateOrgProject,
  assertCanCreatePersonalProject,
  teamMemberLimit,
} from "./entitlements";

describe("billing entitlements", () => {
  describe("assertCanCreatePersonalProject", () => {
    it("allows creation below the free limit (no Pro)", () => {
      expect(() => assertCanCreatePersonalProject(0, false)).not.toThrow();
      expect(() =>
        assertCanCreatePersonalProject(FREE_LIMITS.maxPersonalProjects - 1, false),
      ).not.toThrow();
    });

    it("blocks at and above the free limit with a 402 (no Pro)", () => {
      try {
        assertCanCreatePersonalProject(FREE_LIMITS.maxPersonalProjects, false);
        throw new Error("expected to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(402);
        expect((err as ApiError).message).toMatch(/Pro/);
      }
    });

    it("never blocks when the user holds Pro", () => {
      expect(() =>
        assertCanCreatePersonalProject(FREE_LIMITS.maxPersonalProjects + 500, true),
      ).not.toThrow();
    });
  });

  describe("assertCanCreateOrgProject", () => {
    it("blocks at the flat per-org project limit with a 402", () => {
      expect(() => assertCanCreateOrgProject(MAX_PROJECTS_PER_ORG - 1)).not.toThrow();
      try {
        assertCanCreateOrgProject(MAX_PROJECTS_PER_ORG);
        throw new Error("expected to throw");
      } catch (err) {
        expect((err as ApiError).status).toBe(402);
      }
    });
  });

  describe("team member tiers", () => {
    it("has ascending member limits STARTER < GROWTH < SCALE", () => {
      expect(teamMemberLimit("STARTER")).toBe(TEAM_TIERS.STARTER.maxMembers);
      expect(teamMemberLimit("STARTER")).toBeLessThan(teamMemberLimit("GROWTH"));
      expect(teamMemberLimit("GROWTH")).toBeLessThan(teamMemberLimit("SCALE"));
    });

    it("treats a null tier as SCALE (grandfathered orgs)", () => {
      expect(teamMemberLimit(null)).toBe(teamMemberLimit("SCALE"));
    });

    it("assertCanAddOrgMember blocks once seats used >= the tier limit", () => {
      const limit = teamMemberLimit("STARTER");
      expect(() => assertCanAddOrgMember(limit - 1, "STARTER")).not.toThrow();
      try {
        assertCanAddOrgMember(limit, "STARTER");
        throw new Error("expected to throw");
      } catch (err) {
        expect((err as ApiError).status).toBe(402);
        expect((err as ApiError).message).toMatch(new RegExp(String(limit)));
      }
    });
  });
});
