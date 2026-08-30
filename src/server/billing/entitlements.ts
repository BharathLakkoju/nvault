import type { SubscriptionTier } from "@/generated/prisma/client";
import { env } from "../env";
import { ApiError } from "../http";

/**
 * The single source of truth for plan limits. Kept as plain data + pure
 * assertions with no I/O so it can be unit-tested and imported anywhere.
 *
 * Tiers:
 *   - Free  — a personal vault, capped at FREE_LIMITS.maxPersonalProjects.
 *   - Pro   — a per-user Polar subscription; lifts the personal-project cap.
 *   - Team  — a per-organization Polar subscription in one of three flat
 *             size tiers (STARTER / GROWTH / SCALE). The tier caps how many
 *             members the org may have; every tier gets the same project
 *             allowance.
 *
 * Limits are enforced on *creation* only. They are never retroactive: an
 * account already over a limit keeps everything it has and is simply blocked
 * from creating more until it upgrades. Nothing is deleted or hidden.
 */

export const FREE_LIMITS = {
  /** Personal (non-org) projects a free account may own. */
  maxPersonalProjects: 3,
  /**
   * Versions of a single file a free account may ever create. This is a
   * lifetime high-water mark, NOT a live count — deleting an old version does
   * not free up room (see ProjectFile.versionsCreated).
   */
  maxVersionsPerFile: 2,
  /** Concurrent browser sessions ("devices"); the oldest is evicted past this. */
  maxBrowserSessions: 2,
  /** Active CLI Personal Access Tokens. */
  maxCliTokens: 1,
} as const;

/**
 * Pro lifts every Free cap. Devices are not literally unlimited — just a much
 * higher, still-finite ceiling.
 */
export const PRO_LIMITS = {
  maxBrowserSessions: 5,
  maxCliTokens: 5,
} as const;

/** Projects any paid organization may own, regardless of size tier. */
export const MAX_PROJECTS_PER_ORG = 50;

export const TEAM_TIERS = {
  STARTER: { maxMembers: 10, priceEnv: "TEAM_STARTER_PRICE_LABEL" },
  GROWTH: { maxMembers: 25, priceEnv: "TEAM_GROWTH_PRICE_LABEL" },
  SCALE: { maxMembers: 100, priceEnv: "TEAM_SCALE_PRICE_LABEL" },
} as const satisfies Record<SubscriptionTier, { maxMembers: number; priceEnv: string }>;

export const TEAM_TIER_ORDER: SubscriptionTier[] = ["STARTER", "GROWTH", "SCALE"];
export const DEFAULT_TEAM_TIER: SubscriptionTier = "STARTER";

/** Display-only price strings for the upgrade UI (real amounts live on Polar). */
export function proPlanPriceLabel(): string {
  return env.PRO_PLAN_PRICE_LABEL;
}
export function teamTierPriceLabel(tier: SubscriptionTier): string {
  return env[TEAM_TIERS[tier].priceEnv as keyof typeof env] as string;
}

/** Member ceiling for a tier. A null tier (edge case) is treated as SCALE. */
export function teamMemberLimit(tier: SubscriptionTier | null): number {
  return TEAM_TIERS[tier ?? "SCALE"].maxMembers;
}

export function teamTierInfo() {
  return TEAM_TIER_ORDER.map((tier) => ({
    tier,
    priceLabel: teamTierPriceLabel(tier),
    maxMembers: TEAM_TIERS[tier].maxMembers,
  }));
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/** The personal-project ceiling for a user, given whether they hold Pro. */
export function personalProjectLimit(hasPro: boolean): number {
  return hasPro ? Number.POSITIVE_INFINITY : FREE_LIMITS.maxPersonalProjects;
}

export function assertCanCreatePersonalProject(currentCount: number, hasPro: boolean): void {
  if (currentCount >= personalProjectLimit(hasPro)) {
    throw new ApiError(
      402,
      `Free accounts can keep up to ${FREE_LIMITS.maxPersonalProjects} personal projects. ` +
        "Upgrade to Pro for unlimited personal projects, or create an organization for shared team projects.",
    );
  }
}

// ---------------------------------------------------------------------------
// Version history
// ---------------------------------------------------------------------------

/**
 * How many versions of one file the caller may create. `unlimited` is true for
 * Pro personal projects and for every organization project (governed by the
 * org's own Team subscription, never by the member's personal plan).
 */
export function fileVersionLimit(unlimited: boolean): number {
  return unlimited ? Number.POSITIVE_INFINITY : FREE_LIMITS.maxVersionsPerFile;
}

/**
 * `versionsCreated` is the file's lifetime version count (monotonic — deletes
 * never decrement it). Blocks a free account from adding another version once
 * that ceiling is reached, even if some old versions have since been deleted.
 */
export function assertCanAddFileVersion(versionsCreated: number, unlimited: boolean): void {
  if (versionsCreated >= fileVersionLimit(unlimited)) {
    throw new ApiError(
      402,
      `Free accounts keep up to ${FREE_LIMITS.maxVersionsPerFile} versions of each file. ` +
        "This ceiling counts every version ever uploaded, so deleting an old one does not free up room. " +
        "Upgrade to Pro for unlimited version history.",
    );
  }
}

// ---------------------------------------------------------------------------
// Devices (browser sessions + CLI tokens)
// ---------------------------------------------------------------------------

export function browserSessionLimit(hasPro: boolean): number {
  return hasPro ? PRO_LIMITS.maxBrowserSessions : FREE_LIMITS.maxBrowserSessions;
}

export function cliTokenLimit(hasPro: boolean): number {
  return hasPro ? PRO_LIMITS.maxCliTokens : FREE_LIMITS.maxCliTokens;
}

export function assertCanCreateCliToken(activeCount: number, hasPro: boolean): void {
  const limit = cliTokenLimit(hasPro);
  if (activeCount >= limit) {
    throw new ApiError(
      409,
      hasPro
        ? `You have reached the limit of ${limit} active CLI tokens. Revoke one before creating another.`
        : `Free accounts can have ${limit} active CLI token. Revoke it first, or upgrade to Pro for up to ${PRO_LIMITS.maxCliTokens}.`,
    );
  }
}

export function assertCanCreateOrgProject(currentCount: number): void {
  if (currentCount >= MAX_PROJECTS_PER_ORG) {
    throw new ApiError(
      402,
      `This organization has reached its ${MAX_PROJECTS_PER_ORG}-project limit.`,
    );
  }
}

/**
 * `usedSeats` = active members + pending invites. Blocks adding another when
 * the org is at its tier's member limit.
 */
export function assertCanAddOrgMember(usedSeats: number, tier: SubscriptionTier | null): void {
  const limit = teamMemberLimit(tier);
  if (usedSeats >= limit) {
    throw new ApiError(
      402,
      `This organization's plan allows up to ${limit} members. Upgrade to a larger plan to add more.`,
    );
  }
}
