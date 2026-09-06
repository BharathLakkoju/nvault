"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { createWrappedProjectKey, newId, openOrgKey } from "@/lib/vault-client";
import type { OrganizationDetailDto, ProjectDto } from "@/lib/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiRequest<{ projects: ProjectDto[] }>("/projects").then((r) => r.projects),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => apiRequest<{ project: ProjectDto }>(`/projects/${id}`).then((r) => r.project),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      gitRemoteUrl,
      organizationId,
    }: {
      name: string;
      gitRemoteUrl?: string;
      organizationId?: string | null;
    }) => {
      const { masterKey, privateKey } = useAuthStore.getState();
      if (!masterKey) throw new Error("Vault is locked");
      const id = newId();

      // Personal projects wrap the project key under the master key; org
      // projects wrap it under the Organization Key.
      let wrappingKey = masterKey;
      if (organizationId) {
        if (!privateKey) throw new Error("Vault is locked");
        const detail = await apiRequest<OrganizationDetailDto>(`/organizations/${organizationId}`);
        if (!detail.self.wrappedOrgKey) {
          throw new Error("You don't have access to this organization's key yet.");
        }
        wrappingKey = await openOrgKey(privateKey, detail.self.wrappedOrgKey);
      }

      const { wrappedProjectKey } = await createWrappedProjectKey(wrappingKey, id);
      const result = await apiRequest<{ project: ProjectDto }>("/projects", {
        method: "POST",
        body: { id, name, gitRemoteUrl, wrappedProjectKey, organizationId: organizationId ?? undefined },
      });
      return result.project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      gitRemoteUrl,
    }: {
      id: string;
      name?: string;
      gitRemoteUrl?: string | null;
    }) =>
      apiRequest<{ project: ProjectDto }>(`/projects/${id}`, {
        method: "PATCH",
        body: { ...(name !== undefined ? { name } : {}), ...(gitRemoteUrl !== undefined ? { gitRemoteUrl } : {}) },
      }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
}

export function useRenameProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest<{ project: ProjectDto }>(`/projects/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
