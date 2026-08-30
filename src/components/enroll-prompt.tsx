"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useEnroll } from "@/hooks/use-org-members";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/lib/toast-store";

/**
 * Shown to a member who has accepted an invite but not yet enrolled. They
 * paste the enrollment secret the owner shared out-of-band; the Org Key is
 * recovered and re-wrapped to their own key entirely in the browser.
 */
export function EnrollPrompt({ orgId, onEnrolled }: { orgId: string; onEnrolled?: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enroll = useEnroll(orgId);
  const vaultUnlocked = useAuthStore((s) => s.privateKey !== null);

  if (!vaultUnlocked) {
    return (
      <Card className="border-amber-500/40">
        <div className="p-5 text-sm text-ink/70">
          Unlock your vault to enroll in this organization.
        </div>
      </Card>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await enroll.mutateAsync(secret);
      setSecret("");
      useToastStore.getState().push("success", "You're in — organization projects unlocked.");
      onEnrolled?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? /decrypt|secret/i.test(err.message)
            ? "That enrollment secret didn't work. Check it with whoever invited you."
            : err.message
          : "Couldn't enroll.",
      );
    }
  }

  return (
    <Card className="border-amber-500/40">
      <form onSubmit={submit} className="space-y-3 p-5">
        <div>
          <p className="text-sm font-medium text-ink">Enter the organization enrollment secret</p>
          <p className="mt-1 text-xs text-muted">
            The owner shares this with you separately from the invite link. It unlocks this
            organization&apos;s vault on this device.
          </p>
        </div>
        <div>
          <Label htmlFor="enroll-secret">Enrollment secret</Label>
          <Input
            id="enroll-secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX"
            className="font-mono tracking-wider"
            required
          />
          <FieldError>{error}</FieldError>
        </div>
        <Button type="submit" loading={enroll.isPending}>
          Enroll
        </Button>
      </form>
    </Card>
  );
}
