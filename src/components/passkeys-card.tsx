"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import { registerPasskey } from "@/lib/webauthn-client";
import { toastError, useToastStore } from "@/lib/toast-store";

interface PasskeyDto {
  id: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export function PasskeysCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => apiRequest<{ credentials: PasskeyDto[] }>("/auth/webauthn/credentials"),
  });

  const register = useMutation({
    mutationFn: registerPasskey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      useToastStore.getState().push("success", "Passkey registered");
    },
    onError: (err) => toastError(err, "Passkey registration failed"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/auth/webauthn/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      useToastStore.getState().push("success", "Passkey removed");
    },
    onError: (err) => toastError(err, "Failed to remove passkey"),
  });

  const credentials = data?.credentials ?? [];

  return (
    <Card>
      <CardHeader
        title="Passkeys"
        description="Use a device passkey to confirm sensitive actions like key rotation and CLI token creation."
        action={
          <Button
            type="button"
            variant="secondary"
            disabled={register.isPending}
            onClick={() => register.mutate()}
          >
            Add passkey
          </Button>
        }
      />
      {isLoading && <p className="p-5 text-sm text-muted">Loading…</p>}
      {!isLoading && credentials.length === 0 && (
        <p className="p-5 text-sm text-muted">No passkeys registered yet.</p>
      )}
      <ul className="divide-y divide-line">
        {credentials.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <span className="font-medium text-ink">{c.deviceType ?? "Passkey"}</span>
              <span className="ml-2 text-muted">
                added {formatRelativeTime(c.createdAt)} · last used {formatRelativeTime(c.lastUsedAt)}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(c.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
