import { ApiError } from "../http";
import {
  FREE_LIMITS,
  MAX_PROJECTS_PER_ORG,
  PRO_LIMITS,
  TEAM_TIERS,
  assertCanAddFileVersion,
  assertCanAddOrgMember,
  assertCanCreateCliToken,
  assertCanCreateOrgProject,
  assertCanCreatePersonalProject,
  browserSessionLimit,
  cliTokenLimit,
  fileVersionLimit,
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

  describe("free-tier caps are the tighter values", () => {
    it("keeps the personal-project limit at 3 and version limit at 2", () => {
      expect(FREE_LIMITS.maxPersonalProjects).toBe(3);
      expect(FREE_LIMITS.maxVersionsPerFile).toBe(2);
      expect(FREE_LIMITS.maxBrowserSessions).toBe(2);
      expect(FREE_LIMITS.maxCliTokens).toBe(0);
    });
  });

  describe("fileVersionLimit / assertCanAddFileVersion", () => {
    it("caps a free file at maxVersionsPerFile; unlimited is Infinity", () => {
      expect(fileVersionLimit(false)).toBe(FREE_LIMITS.maxVersionsPerFile);
      expect(fileVersionLimit(true)).toBe(Number.POSITIVE_INFINITY);
    });

    it("allows the first N versions then throws 402 (free)", () => {
      expect(() => assertCanAddFileVersion(0, false)).not.toThrow();
      expect(() => assertCanAddFileVersion(1, false)).not.toThrow();
      try {
        assertCanAddFileVersion(2, false);
        throw new Error("expected to throw");
      } catch (err) {
        expect((err as ApiError).status).toBe(402);
        expect((err as ApiError).message).toMatch(/deleting an old one does not free up room/i);
      }
    });

    it("never throws for an unlimited (Pro / org) file, even far past the free cap", () => {
      expect(() => assertCanAddFileVersion(999, true)).not.toThrow();
    });
  });

  describe("device caps", () => {
    it("browser + CLI limits switch on Pro / CLI access", () => {
      expect(browserSessionLimit(false)).toBe(FREE_LIMITS.maxBrowserSessions);
      expect(browserSessionLimit(true)).toBe(PRO_LIMITS.maxBrowserSessions);
      expect(cliTokenLimit(false)).toBe(0);
      expect(cliTokenLimit(true)).toBe(PRO_LIMITS.maxCliTokens);
    });

    it("assertCanCreateCliToken refuses accounts without CLI access with a 402", () => {
      try {
        assertCanCreateCliToken(0, false);
        throw new Error("expected to throw");
      } catch (err) {
        expect((err as ApiError).status).toBe(402);
        expect((err as ApiError).message).toMatch(/paid feature/i);
      }
    });

    it("assertCanCreateCliToken allows CLI-access accounts up to the ceiling, then 409s", () => {
      expect(() => assertCanCreateCliToken(0, true)).not.toThrow();
      expect(() => assertCanCreateCliToken(PRO_LIMITS.maxCliTokens - 1, true)).not.toThrow();
      try {
        assertCanCreateCliToken(PRO_LIMITS.maxCliTokens, true);
        throw new Error("expected to throw");
      } catch (err) {
        expect((err as ApiError).status).toBe(409);
      }
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
