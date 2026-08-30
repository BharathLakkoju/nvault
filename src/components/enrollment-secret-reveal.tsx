"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/lib/toast-store";

/**
 * Shows an Organization Enrollment Secret exactly once. It is never persisted
 * in plaintext and cannot be recovered — the owner must copy it now and hand
 * it to each invitee over a channel SEPARATE from the invite link (in person,
 * a password-manager share, Signal — not the same chat as the link).
 */
export function EnrollmentSecretReveal({
  secret,
  onDone,
  context = "new",
}: {
  secret: string;
  onDone?: () => void;
  context?: "new" | "rotated";
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-4">
      <div>
        <p className="text-sm font-medium text-ink">
          {context === "rotated"
            ? "The organization key was rotated — here is the new enrollment secret"
            : "Organization enrollment secret"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Shown once and never again. New members need it to unlock this organization&apos;s
          vault. Share it <span className="font-medium text-ink">out-of-band</span> — not in the
          same message as the invite link.
        </p>
      </div>

      {revealed ? (
        <code className="block select-all overflow-x-auto rounded-md bg-surface-2 px-3 py-2 text-center font-mono text-sm tracking-wider text-ink">
          {secret}
        </code>
      ) : (
        <Button variant="secondary" onClick={() => setRevealed(true)}>
          Reveal secret
        </Button>
      )}

      {revealed && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(secret)
                .then(() => useToastStore.getState().push("success", "Copied"))
                .catch(() => undefined)
            }
          >
            Copy
          </Button>
          {onDone && (
            <Button variant="ghost" onClick={onDone}>
              I&apos;ve saved it
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
