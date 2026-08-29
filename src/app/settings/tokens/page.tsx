"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
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

interface CreateResponse {
  token: string;
  apiToken: ApiTokenDto;
}

function TokensContent() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => apiRequest<{ tokens: ApiTokenDto[] }>("/auth/tokens").then((r) => r.tokens),
  });

  const create = useMutation({
    mutationFn: (tokenName: string) =>
      apiRequest<CreateResponse>("/auth/tokens", { method: "POST", body: { name: tokenName } }),
    onSuccess: (res) => {
      setFreshToken(res.token);
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

  const active = tokens?.filter((t) => !t.revokedAt) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium text-ink sm:text-[28px]">CLI access tokens</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">New token</Button>
          </DialogTrigger>
          <DialogContent
            title="Create a CLI access token"
            description="Use it with `nvault login --token <token>`. Treat it like a password — it grants full access to your vault's encrypted data over the API."
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
      </div>

      {freshToken && (
        <Card className="border-accent-500/40">
          <div className="space-y-3 p-5">
            <div>
              <h2 className="text-base font-medium text-ink">
                Copy your new token now
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                This is the only time it will be shown. If you lose it, revoke it and create a new one.
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
              <Button variant="ghost" onClick={() => setFreshToken(null)}>
                Done
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Your tokens"
          description="Each token is a long-lived credential for the CLI. Revoking one takes effect immediately."
        />
        {isLoading && <p className="p-5 text-sm text-muted">Loading…</p>}
        {!isLoading && active.length === 0 && (
          <p className="p-5 text-sm text-muted">
            No active tokens. Create one to authenticate the <code>nvault</code> CLI.
          </p>
        )}
        <ul className="divide-y divide-line">
          {active.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{t.name}</div>
                <p className="text-xs text-muted">
                  <code>{t.tokenPrefix}…</code> · created {formatRelativeTime(t.createdAt)} · last used{" "}
                  {formatRelativeTime(t.lastUsedAt)} · expires {formatRelativeTime(t.expiresAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-red-600 dark:text-red-400"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(t.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
