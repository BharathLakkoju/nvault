"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { generateOrgKey, wrapForMember } from "@/lib/vault-client";
import type { OrganizationDetailDto, OrganizationDto } from "@/lib/types";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      apiRequest<{ organizations: OrganizationDto[] }>("/organizations").then((r) => r.organizations),
  });
}

export function useOrganization(id: string | null) {
  return useQuery({
    queryKey: ["organizations", id],
    queryFn: () => apiRequest<OrganizationDetailDto>(`/organizations/${id}`),
    enabled: !!id,
  });
}

/**
 * Creates an organization. The Org Key is generated here, in the browser,
 * and only ever leaves wrapped to the creator's own public key.
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, slug }: { name: string; slug: string }) => {
      const { keyPairMaterial, privateKey } = useAuthStore.getState();
      if (!privateKey || !keyPairMaterial) {
        throw new Error("Unlock your vault before creating an organization.");
      }
      const orgKey = generateOrgKey();
      const wrappedOrgKey = await wrapForMember(keyPairMaterial.publicKey, orgKey);
      const res = await apiRequest<{ organization: OrganizationDto }>("/organizations", {
        method: "POST",
        body: { name, slug, wrappedOrgKey },
      });
      return res.organization;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useRenameOrganization(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; slug?: string }) =>
      apiRequest<{ organization: OrganizationDto }>(`/organizations/${id}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", id] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/organizations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  });
}
