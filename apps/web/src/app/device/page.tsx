"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiRequest, ApiError } from "@/lib/api-client";

type Step = "entering" | "confirming" | "approved" | "denied";

function DeviceApprovalContent() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("user_code") ?? "");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("entering");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(userCode: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ deviceName: string | null }>(
        `/auth/device/lookup?userCode=${encodeURIComponent(userCode)}`,
      );
      setDeviceName(result.deviceName);
      setStep("confirming");
    } catch (err) {
      setError(err instanceof ApiError ? "That code is invalid or has expired." : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("user_code");
    if (initial) void lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprove() {
    setLoading(true);
    try {
      await apiRequest("/auth/device/approve", { method: "POST", body: { userCode: code } });
      setStep("approved");
    } catch {
      setError("Failed to approve — the code may have expired. Try again from the CLI.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeny() {
    setLoading(true);
    try {
      await apiRequest("/auth/device/deny", { method: "POST", body: { userCode: code } });
      setStep("denied");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Authorize a device</h1>

        {step === "entering" && (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter the code shown in your terminal.
            </p>
            <div className="mt-4">
              <Label htmlFor="code">Device code</Label>
              <Input
                id="code"
                autoFocus
                placeholder="X7KD-29PL"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <FieldError>{error}</FieldError>
            </div>
            <Button className="mt-4 w-full" loading={loading} onClick={() => lookup(code)} disabled={!code}>
              Continue
            </Button>
          </>
        )}

        {step === "confirming" && (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              A CLI{deviceName ? ` on "${deviceName}"` : ""} is requesting access to your EnvVault account.
              Only approve this if you just ran <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">envvault login</code> yourself.
            </p>
            <FieldError>{error}</FieldError>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" loading={loading} onClick={handleDeny}>
                Deny
              </Button>
              <Button className="flex-1" loading={loading} onClick={handleApprove}>
                Approve
              </Button>
            </div>
          </>
        )}

        {step === "approved" && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            ✓ Device authorized. You can return to your terminal.
          </p>
        )}
        {step === "denied" && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Request denied.</p>
        )}
      </Card>
    </div>
  );
}

export default function DevicePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={null}>
          <DeviceApprovalContent />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
