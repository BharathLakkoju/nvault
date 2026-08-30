"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { TeamTierInfo } from "@/lib/types";

export interface FreeLimits {
  maxPersonalProjects: number;
  maxVersionsPerFile: number;
  maxBrowserSessions: number;
  maxCliTokens: number;
}

export interface ProLimits {
  maxBrowserSessions: number;
  maxCliTokens: number;
}

export interface PlanInfo {
  proPriceLabel: string;
  teamTiers: TeamTierInfo[];
  billingEnabled: boolean;
  freeLimits: FreeLimits;
  proLimits: ProLimits;
  /** @deprecated use freeLimits.maxPersonalProjects */
  freeMaxPersonalProjects: number;
}

/** Non-secret plan metadata (price label, free-tier limits). Cached for the session. */
export function usePlanInfo() {
  return useQuery({
    queryKey: ["billing", "plan"],
    queryFn: () => apiRequest<PlanInfo>("/billing/plan"),
    staleTime: 10 * 60 * 1000,
  });
}
