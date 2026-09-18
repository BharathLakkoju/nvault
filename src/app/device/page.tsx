"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useToastStore } from "@/lib/toast-store";

export default function DevicePage() {
  return (
    <RequireAuth>
      <AppShell>
        <DeviceApproval />
      </AppShell>
    </RequireAuth>
  );
}

function DeviceApproval() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("code");
    if (fromQuery) setCode(fromQuery);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiRequest<void>("/auth/device/approve", {
        method: "POST",
        body: { userCode: code },
      });
      setDone(true);
      useToastStore.getState().push("success", "Device approved — you can return to your terminal.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve this device.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-medium text-ink">Device approved</h1>
        <p className="mt-2 text-sm text-muted">
          Your terminal should finish signing in automatically. You can close this tab.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-medium text-ink">Approve a CLI device</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the code shown in your terminal after running <code className="font-mono">nvault login</code>. CLI access
        requires a <Link href="/settings/billing" className="text-accent-600 hover:underline dark:text-accent-300">Pro or Team</Link>{" "}
        plan.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="device-code">Device code</Label>
          <Input
            id="device-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="X7KD-29PL"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono uppercase tracking-widest"
            maxLength={16}
            required
          />
          <FieldError>{error}</FieldError>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Approve device
        </Button>
      </form>
    </Card>
  );
}
