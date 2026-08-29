"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { RequireVaultUnlocked } from "@/components/require-vault-unlocked";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAcceptInvite } from "@/hooks/use-org-members";
import { useOrgContext } from "@/lib/org-context-store";
import { useAuthStore } from "@/lib/auth-store";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();

  // Stash the token so we can come back to it after login if needed.
  useEffect(() => {
    try {
      sessionStorage.setItem("nvault.pendingInvite", token);
    } catch {
      /* ignore */
    }
  }, [token]);

  return (
    <RequireAuth>
      <AppShell>
        <RequireVaultUnlocked>
          <AcceptInvite token={token} />
        </RequireVaultUnlocked>
      </AppShell>
    </RequireAuth>
  );
}

function AcceptInvite({ token }: { token: string }) {
  const accept = useAcceptInvite();
  const router = useRouter();
  const setCurrentOrg = useOrgContext((s) => s.setCurrentOrg);
  const email = useAuthStore((s) => s.user?.email);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    try {
      const res = await accept.mutateAsync(token);
      try {
        sessionStorage.removeItem("nvault.pendingInvite");
      } catch {
        /* ignore */
      }
      setDone(res.organization);
      setCurrentOrg(res.organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept this invitation.");
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-base font-medium text-ink">
          You&apos;ve joined {done.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          An admin needs to grant you access to the organization&apos;s encryption key before you can
          open its projects.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => router.push(`/organizations/${done.id}`)}>Go to organization</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-base font-medium text-ink">
        Organization invitation
      </h1>
      <p className="mt-1 text-sm text-muted">
        Accepting as <span className="font-medium">{email}</span>. The invitation must have been sent
        to this address.
      </p>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={handleAccept} loading={accept.isPending}>
          Accept invitation
        </Button>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
