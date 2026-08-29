"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { SubscriptionDto } from "@/lib/types";

interface PersonalBillingDto {
  priceLabel: string;
  pro: SubscriptionDto;
}

/** The caller's personal (Pro) subscription state. */
export function useProSubscription() {
  return useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: () => apiRequest<PersonalBillingDto>("/billing/subscription"),
  });
}

/** Starts Pro checkout; resolves to the Polar checkout URL to redirect to. */
export function useStartProCheckout() {
  return useMutation({
    mutationFn: () => apiRequest<{ url: string }>("/billing/pro/checkout", { method: "POST" }),
  });
}

/** Opens the Polar customer portal for the caller's own billing. */
export function usePersonalBillingPortal() {
  return useMutation({
    mutationFn: () => apiRequest<{ url: string }>("/billing/portal"),
  });
}
