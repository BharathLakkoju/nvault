"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import {
  createOrgEnrollment,
  decryptRoster,
  encryptRoster,
  fingerprintPublicKey,
  generateOrgKey,
  openOrgKey,
  openOrgKeyWithSecret,
  openProjectKey,
  rewrapProjectKey,
  rosterWithEntry,
  verifyAgainstRoster,
  wrapForMember,
} from "@/lib/vault-client";
import type { OrgActivityEntryDto, OrgInviteDto, OrgRole, ProjectDto } from "@/lib/types";
import { useOrganization } from "./use-organizations";

/** A member public key served by the API did not match its roster pin. */
export class RosterKeyMismatch extends Error {
  constructor(public readonly userIds: string[]) {
    super(
      "One or more members' encryption keys don't match what was pinned when they joined. " +
        "This can mean the server tried to substitute a key. Verify with those members " +
        "out-of-band before rotating.",
    );
    this.name = "RosterKeyMismatch";
  }
}

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
 * Completes the caller's own join. They type in the Enrollment Secret the
 * org owner shared out-of-band; the client recovers the Org Key from the
 * server's OES-wrapped blob, re-wraps it to the caller's own public key,
 * adds the caller's fingerprint to the roster, and submits all three. The
 * secret never leaves the browser.
 */
export function useEnroll(orgId: string) {
  const queryClient = useQueryClient();
  const { data: detail } = useOrganization(orgId);
  return useMutation({
    mutationFn: async (enrollmentSecret: string) => {
      const { keyPairMaterial, user } = useAuthStore.getState();
      if (!keyPairMaterial || !user) throw new Error("Unlock your vault first.");
      if (!detail) throw new Error("Organization not loaded yet.");

      const orgKey = await openOrgKeyWithSecret(enrollmentSecret.trim(), detail.enrollment);
      const wrappedOrgKey = await wrapForMember(keyPairMaterial.publicKey, orgKey);

      // Read-modify-write on the roster, guarded by its version server-side.
      const roster = await decryptRoster(orgKey, detail.roster);
      const next = rosterWithEntry(roster, user.id, {
        fingerprint: await fingerprintPublicKey(keyPairMaterial.publicKey),
        addedAt: new Date().toISOString(),
      });
      const rosterBlob = await encryptRoster(orgKey, next);

      return apiRequest(`/organizations/${orgId}/enroll`, {
        method: "POST",
        body: {
          wrappedOrgKey,
          keyEpoch: detail.enrollment.keyEpoch,
          pinnedPublicKey: keyPairMaterial.publicKey,
          roster: rosterBlob,
          expectedRosterVersion: detail.roster.version,
        },
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

      const activeMembers = detail.members.filter(
        (m): m is typeof m & { publicKey: string } => m.status === "ACTIVE" && !!m.publicKey,
      );

      // Verify every member's served public key against the roster pin BEFORE
      // wrapping the new key to it — a substituted key aborts here.
      const oldRoster = await decryptRoster(oldOrgKey, detail.roster);
      const { mismatched, unpinned } = await verifyAgainstRoster(
        oldRoster,
        activeMembers.map((m) => ({ userId: m.userId, publicKey: m.publicKey })),
      );
      if (mismatched.length > 0) {
        throw new RosterKeyMismatch(mismatched.map((x) => x.userId));
      }

      const allProjects = await apiRequest<{ projects: ProjectDto[] }>("/projects").then(
        (r) => r.projects,
      );
      const orgProjects = allProjects.filter((p) => p.organizationId === orgId);
      const projectKeys = await Promise.all(
        orgProjects.map(async (p) => {
          const projectKey = await openProjectKey(oldOrgKey, p.id, p.wrappedProjectKey);
          return {
            projectId: p.id,
            wrappedProjectKey: await rewrapProjectKey(newOrgKey, p.id, projectKey),
          };
        }),
      );

      const memberKeys = await Promise.all(
        activeMembers.map(async (m) => ({
          membershipId: m.id,
          wrappedOrgKey: await wrapForMember(m.publicKey, newOrgKey),
        })),
      );

      // Rebuild the roster: keep a pin for every current active member.
      // Trust-on-first-use for any that had none (the served key becomes the
      // pin now that we are about to wrap the new Org Key to it).
      const unpinnedSet = new Set(unpinned.map((x) => x.userId));
      let nextRoster = { version: oldRoster.version, entries: {} as typeof oldRoster.entries };
      for (const m of activeMembers) {
        const existing = oldRoster.entries[m.userId];
        nextRoster.entries[m.userId] = unpinnedSet.has(m.userId)
          ? { fingerprint: await fingerprintPublicKey(m.publicKey), addedAt: new Date().toISOString() }
          : existing;
      }
      nextRoster = { version: oldRoster.version + 1, entries: nextRoster.entries };
      const rosterBlob = await encryptRoster(newOrgKey, nextRoster);

      // A new Org Key means a new Enrollment Secret. The old one can no longer
      // unwrap anything; the owner must save this and use it for future
      // invites.
      const { secret: enrollmentSecret, enrollment } = await createOrgEnrollment(newOrgKey);

      const res = await apiRequest<{ epoch: number }>(`/organizations/${orgId}/rotate-key`, {
        method: "POST",
        body: {
          newEpoch,
          projectKeys,
          memberKeys,
          enrollment,
          roster: rosterBlob,
          expectedRosterVersion: detail.roster.version,
        },
      });
      return { ...res, enrollmentSecret };
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
