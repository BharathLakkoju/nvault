"use client";

import { useState, type FormEvent } from "react";
import { DecryptionError } from "@/lib/crypto";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "./ui/button";
import { Input, Label, FieldError } from "./ui/input";
import { Card } from "./ui/card";

/**
 * Gates any UI that needs the vault master key (creating projects,
 * uploading/downloading/decrypting files). The master key only ever lives
 * in memory for this tab, so every fresh page load — and every explicit
 * "lock vault" — requires the passphrase again. There is no way to bypass
 * this from the server: it never has the key material to hand out.
 */
export function RequireVaultUnlocked({ children }: { children: React.ReactNode }) {
  const masterKey = useAuthStore((s) => s.masterKey);
  const unlockVault = useAuthStore((s) => s.unlockVault);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (masterKey) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await unlockVault(passphrase);
      setPassphrase("");
    } catch (err) {
      setError(
        err instanceof DecryptionError
          ? "Incorrect vault passphrase."
          : "Couldn't unlock the vault. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Unlock your vault</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your vault passphrase never leaves this device. It&apos;s separate from your account password and is
          required to decrypt your files.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="vault-passphrase">Vault passphrase</Label>
            <Input
              id="vault-passphrase"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
            <FieldError>{error}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Unlock
          </Button>
        </form>
      </Card>
    </div>
  );
}
