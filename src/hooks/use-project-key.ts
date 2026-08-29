"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { openProjectKey } from "@/lib/vault-client";
import type { ProjectDto } from "@/lib/types";
import { useOrgKey } from "./use-org-key";

/**
 * Unwraps a project's data key.
 *
 * - Personal project: unwrapped with the vault master key.
 * - Org project: unwrapped with the Organization Key (itself recovered from
 *   the caller's RSA private key — see {@link useOrgKey}).
 */
export function useProjectKey(project: ProjectDto | undefined) {
  const masterKey = useAuthStore((s) => s.masterKey);
  const isOrg = project?.scope === "org";
  const { orgKey, error: orgKeyError, awaitingKeyGrant } = useOrgKey(
    isOrg ? project?.organizationId : null,
  );
  const wrappingKey = isOrg ? orgKey : masterKey;

  const [projectKey, setProjectKey] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setProjectKey(null);
    setError(null);
    if (!wrappingKey || !project) return;
    let cancelled = false;
    openProjectKey(wrappingKey, project.id, project.wrappedProjectKey)
      .then((key) => {
        if (!cancelled) setProjectKey(key);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [wrappingKey, project]);

  return { projectKey, error: error ?? orgKeyError, awaitingKeyGrant };
}
