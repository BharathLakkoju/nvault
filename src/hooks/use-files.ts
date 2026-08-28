"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { encryptFile } from "@/lib/vault-client";
import type { DownloadedFileDto, FileDto } from "@/lib/types";

export function useFiles(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "files"],
    queryFn: () => apiRequest<{ files: FileDto[] }>(`/projects/${projectId}/files`).then((r) => r.files),
    enabled: !!projectId,
  });
}

export function useUploadFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      filename,
      plaintext,
      projectKey,
    }: {
      filename: string;
      plaintext: Uint8Array;
      projectKey: Uint8Array;
    }) => {
      const { contentId, payload, plaintextSize, plaintextSha256 } = await encryptFile(projectKey, plaintext);
      return apiRequest(`/projects/${projectId}/files`, {
        method: "POST",
        body: { filename, payload, contentId, plaintextSize, plaintextSha256 },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "files"] }),
  });
}

export async function downloadFileVersion(projectId: string, fileId: string, versionId: string) {
  return apiRequest<DownloadedFileDto>(`/projects/${projectId}/files/${fileId}/versions/${versionId}`);
}

export function useFileVersions(projectId: string, fileId: string | null) {
  return useQuery({
    queryKey: ["projects", projectId, "files", fileId, "versions"],
    queryFn: () =>
      apiRequest<{ versions: import("@/lib/types").FileVersionSummaryDto[] }>(
        `/projects/${projectId}/files/${fileId}/versions`,
      ).then((r) => r.versions),
    enabled: !!fileId,
  });
}

export function useRestoreVersion(projectId: string, fileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      apiRequest(`/projects/${projectId}/files/${fileId}/restore`, { method: "POST", body: { versionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "files", fileId, "versions"] });
    },
  });
}

export function useDeleteFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => apiRequest<void>(`/projects/${projectId}/files/${fileId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "files"] }),
  });
}
