"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { createWrappedProjectKey, newId } from "@/lib/vault-client";
import type { ProjectDto } from "@/lib/types";

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
    mutationFn: async ({ name, gitRemoteUrl }: { name: string; gitRemoteUrl?: string }) => {
      const masterKey = useAuthStore.getState().masterKey;
      if (!masterKey) throw new Error("Vault is locked");
      const id = newId();
      const { wrappedProjectKey } = await createWrappedProjectKey(masterKey, id);
      const result = await apiRequest<{ project: ProjectDto }>("/projects", {
        method: "POST",
        body: { id, name, gitRemoteUrl, wrappedProjectKey },
      });
      return result.project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useRenameProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest<{ project: ProjectDto }>(`/projects/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
