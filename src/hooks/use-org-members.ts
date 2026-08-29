"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import {
  generateOrgKey,
  openOrgKey,
  openProjectKey,
  rewrapProjectKey,
  wrapForMember,
} from "@/lib/vault-client";
import type { OrgActivityEntryDto, OrgInviteDto, OrgRole, ProjectDto } from "@/lib/types";
import { useOrganization } from "./use-organizations";

function invalidate(queryClient: ReturnType<typeof useQueryClient>, orgId: string) {
  queryClient.invalidateQueries({ queryKey: ["organizations", orgId] });
  queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "invites"] });
  queryClient.invalidateQueries({ queryKey: ["organizations"] });
}

export function useOrgInvites(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["organizations", orgId, "invites"],
    queryFn: () =>
      apiRequest<{ invites: OrgInviteDto[] }>(`/organizations/${orgId}/invites`).then((r) => r.invites),
    enabled,
  });
}

export function useOrgActivity(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["organizations", orgId, "activity"],
    queryFn: () =>
      apiRequest<{ entries: OrgActivityEntryDto[] }>(`/organizations/${orgId}/activity`).then(
        (r) => r.entries,
      ),
    enabled,
  });
}

export function useCreateInvite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: OrgRole }) =>
      apiRequest<{ token: string; invite: OrgInviteDto }>(`/organizations/${orgId}/invites`, {
        method: "POST",
        body,
      }),
    onSuccess: () => invalidate(queryClient, orgId),
  });
}

export function useRevokeInvite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest<void>(`/organizations/${orgId}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(queryClient, orgId),
  });
}

/**
 * Grants a member the Organization Key. The wrap happens here in the admin's
 * browser: unwrap our own Org Key with our private key, re-wrap it to the
 * target member's public key, and send only the ciphertext.
 */
export function useGrantKey(orgId: string) {
  const queryClient = useQueryClient();
  const { data: detail } = useOrganization(orgId);
  return useMutation({
    mutationFn: async ({ membershipId, publicKey }: { membershipId: string; publicKey: string }) => {
      const { privateKey } = useAuthStore.getState();
      if (!privateKey) throw new Error("Unlock your vault first.");
      if (!detail?.self.wrappedOrgKey) throw new Error("You don't have this organization's key.");
      const orgKey = await openOrgKey(privateKey, detail.self.wrappedOrgKey);
      const wrappedOrgKey = await wrapForMember(publicKey, orgKey);
      return apiRequest(`/organizations/${orgId}/memberships/${membershipId}/grant-key`, {
        method: "POST",
        body: { wrappedOrgKey, keyEpoch: detail.organization.currentKeyEpoch },
      });
    },
    onSuccess: () => invalidate(queryClient, orgId),
  });
}

export function useChangeMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: OrgRole }) =>
      apiRequest(`/organizations/${orgId}/memberships/${membershipId}`, {
        method: "PATCH",
        body: { role },
      }),
    onSuccess: () => invalidate(queryClient, orgId),
  });
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      apiRequest<{ rotationRequired: boolean }>(
        `/organizations/${orgId}/memberships/${membershipId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => invalidate(queryClient, orgId),
  });
}

export function useTransferOwnership(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (toMembershipId: string) =>
      apiRequest(`/organizations/${orgId}/transfer-ownership`, {
        method: "POST",
        body: { toMembershipId },
      }),
    onSuccess: () => invalidate(queryClient, orgId),
  });
}

/**
 * Rotates the Organization Key. Generates a fresh Org Key in the browser,
 * re-wraps every org project key and every active member's Org Key under it,
 * and submits the whole set. Run this after removing a member so their old
 * key copy is worthless.
 */
export function useRotateOrgKey(orgId: string) {
  const queryClient = useQueryClient();
  const { data: detail } = useOrganization(orgId);
  return useMutation({
    mutationFn: async () => {
      const { privateKey } = useAuthStore.getState();
      if (!privateKey) throw new Error("Unlock your vault first.");
      if (!detail?.self.wrappedOrgKey) throw new Error("You don't have this organization's key.");

      const oldOrgKey = await openOrgKey(privateKey, detail.self.wrappedOrgKey);
      const newOrgKey = generateOrgKey();
      const newEpoch = detail.organization.currentKeyEpoch + 1;

      const allProjects = await apiRequest<{ projects: ProjectDto[] }>("/projects").then(
        (r) => r.projects,
      );
      const orgProjects = allProjects.filter((p) => p.organizationId === orgId);
      const projectKeys = await Promise.all(
        orgProjects.map(async (p) => {
          const projectKey = await openProjectKey(oldOrgKey, p.id, p.wrappedProjectKey);
          return { projectId: p.id, wrappedProjectKey: await rewrapProjectKey(newOrgKey, p.id, projectKey) };
        }),
      );

      const activeMembers = detail.members.filter((m) => m.status === "ACTIVE" && m.publicKey);
      const memberKeys = await Promise.all(
        activeMembers.map(async (m) => ({
          membershipId: m.id,
          wrappedOrgKey: await wrapForMember(m.publicKey!, newOrgKey),
        })),
      );

      return apiRequest(`/organizations/${orgId}/rotate-key`, {
        method: "POST",
        body: { newEpoch, projectKeys, memberKeys },
      });
    },
    onSuccess: () => {
      invalidate(queryClient, orgId);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiRequest<{ organization: { id: string; name: string }; role: OrgRole }>("/invites/accept", {
        method: "POST",
        body: { token },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  });
}
