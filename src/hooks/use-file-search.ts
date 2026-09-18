"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";

export interface FileSearchResult {
  id: string;
  filename: string;
  projectId: string;
  projectName: string;
}

export function useFileSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", "files", q],
    queryFn: () => apiRequest<{ files: FileSearchResult[] }>(`/search/files?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    select: (data) => data.files,
    staleTime: 30_000,
  });
}
