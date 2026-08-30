import type { OrgBillingStatus, TeamTier } from "@/lib/types";

/** "STARTER" -> "Starter". */
export function teamTierLabel(tier: TeamTier | null | undefined): string {
  if (!tier) return "Team";
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

/** "Team · Starter" for a full plan name, or just "Team" when the tier is unknown. */
export function teamPlanLabel(tier: TeamTier | null | undefined): string {
  return tier ? `Team · ${teamTierLabel(tier)}` : "Team";
}

export interface OrgStatusPresentation {
  label: string;
  /** Tailwind text-color class for a status dot / pill. */
  tone: "ok" | "warn" | "danger";
}

export function orgStatusPresentation(status: OrgBillingStatus): OrgStatusPresentation {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", tone: "ok" };
    case "PENDING_PAYMENT":
      return { label: "Payment pending", tone: "warn" };
    case "SUSPENDED":
      return { label: "Subscription inactive", tone: "danger" };
  }
}
