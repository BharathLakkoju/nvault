"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import { isPasskeyStepUpRequired, verifyPasskeyStepUp } from "@/lib/webauthn-client";
import { toastError, useToastStore } from "@/lib/toast-store";
import type { ApiTokenDto } from "@/lib/types";

export default function TokensPage() {
  return (
    <RequireAuth>
      <AppShell>
        <TokensContent />
      </AppShell>
    </RequireAuth>
  );
}

interface TokensResponse {
  /** Whether this account may create new CLI tokens (Pro / Team). */
  cliAccess: boolean;
  tokens: ApiTokenDto[];
}

interface CreateResponse {
  token: string;
  apiToken: ApiTokenDto;
}

/**
 * The raw token is only ever returned once, at creation (the server keeps just
 * a SHA-256 hash). We stash it in `sessionStorage` so a reload or an accidental
 * navigation within the same tab doesn't lose it before the user copies it —
 * it never leaves this browser tab and is cleared as soon as they're done.
 */
const FRESH_TOKEN_KEY = "nvault:fresh-cli-token";

function readFreshToken(): string | null {
  try {
    return window.sessionStorage.getItem(FRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function TokensContent() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  // Restore a just-created token that a reload would otherwise drop. Reading
  // `sessionStorage` (an external system) can only happen post-mount, so this
  // is a deliberate sync-from-external, not derived state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFreshToken(readFreshToken());
  }, []);

  const stashFreshToken = (token: string | null) => {
    setFreshToken(token);
    try {
      if (token) window.sessionStorage.setItem(FRESH_TOKEN_KEY, token);
      else window.sessionStorage.removeItem(FRESH_TOKEN_KEY);
    } catch {
      /* private mode / storage disabled — the in-memory copy still works */
    }
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => apiRequest<TokensResponse>("/auth/tokens"),
  });

  const cliAccess = data?.cliAccess ?? false;
  const allTokens = data?.tokens ?? [];
  const active = allTokens.filter((t) => !t.revokedAt);
  const revoked = allTokens.filter((t) => t.revokedAt);

  const create = useMutation({
    mutationFn: async (tokenName: string) => {
      try {
        return await apiRequest<CreateResponse>("/auth/tokens", {
          method: "POST",
          body: { name: tokenName },
        });
      } catch (err) {
        if (isPasskeyStepUpRequired(err)) {
          await verifyPasskeyStepUp();
          return apiRequest<CreateResponse>("/auth/tokens", {
            method: "POST",
            body: { name: tokenName },
          });
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      stashFreshToken(res.token);
      setName("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (err) => toastError(err, "Failed to create token"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/auth/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      useToastStore.getState().push("success", "Token revoked");
    },
    onError: (err) => toastError(err, "Failed to revoke token"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium text-ink sm:text-[28px]">CLI access tokens</h1>
        {cliAccess && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">New token</Button>
            </DialogTrigger>
            <DialogContent
              title="Create a CLI access token"
              description="You'll see the token once — copy it and run `nvault login --token <token>` on the machine you want to sign in. New tokens expire after 90 days by default (extended on use, up to one year). If you've registered a passkey, you'll be asked to confirm with it."
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) create.mutate(name.trim());
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="token-name">Name</Label>
                  <Input
                    id="token-name"
                    autoFocus
                    placeholder="work laptop"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
                    Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isLoading && !isError && !cliAccess && (
        <Card className="flex flex-col gap-3 border-amber-500/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/70">
            <span className="font-medium text-ink">CLI access is a paid feature.</span> Upgrade to
            Pro, or join a Team organization, to authenticate the <code>nvault</code> CLI and use{" "}
            <code>push</code>, <code>pull</code>, and <code>run</code>.
            {active.length > 0 &&
              " Tokens you created earlier still work and are listed below; you can revoke them here."}
          </p>
          <Link href="/settings/billing" className="shrink-0">
            <Button variant="secondary" className="w-full sm:w-auto">
              Upgrade to Pro
            </Button>
          </Link>
        </Card>
      )}

      {freshToken && (
        <Card className="border-accent-500/40">
          <div className="space-y-3 p-5">
            <div>
              <h2 className="text-base font-medium text-ink">Copy your new token now</h2>
              <p className="mt-0.5 text-sm text-muted">
                This is the <span className="font-medium text-ink">only time</span> the token is
                shown. Paste it into <code>nvault login</code> once on the machine you want to sign
                in — that login persists afterward, so you only need the token once. If you lose it
                before signing in, revoke it and create a new one.
              </p>
            </div>
            <code className="block overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-sm text-ink">
              {freshToken}
            </code>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(freshToken)
                    .then(() => useToastStore.getState().push("success", "Copied to clipboard"))
                    .catch(() => undefined);
                }}
              >
                Copy
              </Button>
              <Button variant="ghost" onClick={() => stashFreshToken(null)}>
                Done
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Your tokens"
          description="A token's value is shown only once, when you create it — it can't be retrieved again. Each token signs one terminal in with `nvault login`; revoking it takes effect immediately."
        />

        {isLoading && <p className="p-5 text-sm text-muted">Loading…</p>}

        {isError && (
          <div className="flex flex-col items-start gap-2 p-5">
            <p className="text-sm text-muted">Couldn&apos;t load your tokens.</p>
            <Button variant="secondary" loading={isFetching} onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && active.length === 0 && (
          <p className="p-5 text-sm text-muted">
            {cliAccess ? (
              <>
                No active tokens. Create one to authenticate the <code>nvault</code> CLI.
              </>
            ) : (
              <>No active tokens.</>
            )}
          </p>
        )}

        {active.length > 0 && (
          <ul className="divide-y divide-line">
            {active.map((t) => (
              <TokenRow
                key={t.id}
                token={t}
                onRevoke={() => revoke.mutate(t.id)}
                revoking={revoke.isPending}
              />
            ))}
          </ul>
        )}

        {!isLoading && !isError && revoked.length > 0 && (
          <div className="border-t border-line">
            <button
              type="button"
              onClick={() => setShowRevoked((v) => !v)}
              className="focus-ring w-full px-5 py-3 text-left text-xs font-medium text-muted hover:text-ink"
            >
              {showRevoked ? "Hide" : "Show"} revoked tokens ({revoked.length})
            </button>
            {showRevoked && (
              <ul className="divide-y divide-line">
                {revoked.map((t) => (
                  <TokenRow key={t.id} token={t} />
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TokenRow({
  token: t,
  onRevoke,
  revoking,
}: {
  token: ApiTokenDto;
  onRevoke?: () => void;
  revoking?: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          {t.name}
          {t.revokedAt && (
            <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-xs font-normal text-muted">
              revoked {formatRelativeTime(t.revokedAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted">
          <code>{t.tokenPrefix}…</code> · created {formatRelativeTime(t.createdAt)} · last used{" "}
          {formatRelativeTime(t.lastUsedAt)} · expires {formatRelativeTime(t.expiresAt)}
        </p>
      </div>
      {onRevoke && (
        <Button
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          loading={revoking}
          onClick={onRevoke}
        >
          Revoke
        </Button>
      )}
    </li>
  );
}
