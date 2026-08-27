"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { openProjectKey } from "@/lib/vault-client";
import type { ProjectDto } from "@/lib/types";

/** Unwraps a project's data key with the (already-unlocked) vault master key. */
export function useProjectKey(project: ProjectDto | undefined) {
  const masterKey = useAuthStore((s) => s.masterKey);
  const [projectKey, setProjectKey] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setProjectKey(null);
    setError(null);
    if (!masterKey || !project) return;
    let cancelled = false;
    openProjectKey(masterKey, project.id, project.wrappedProjectKey)
      .then((key) => {
        if (!cancelled) setProjectKey(key);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [masterKey, project]);

  return { projectKey, error };
}
