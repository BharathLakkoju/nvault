"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { TeamTierInfo } from "@/lib/types";

export interface PlanInfo {
  proPriceLabel: string;
  teamTiers: TeamTierInfo[];
  billingEnabled: boolean;
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
