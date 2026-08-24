"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as vaultCrypto from "@envvault/crypto";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultPassphraseConfirm, setVaultPassphraseConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError("Account password must be at least 12 characters.");
      return;
    }
    if (vaultPassphrase.length < 12) {
      setError("Vault passphrase must be at least 12 characters.");
      return;
    }
    if (vaultPassphrase !== vaultPassphraseConfirm) {
      setError("Vault passphrases don't match.");
      return;
    }

    setLoading(true);
    try {
      // Zero-knowledge setup happens entirely client-side: the server only
      // ever receives the wrapped (encrypted) master key, never the
      // passphrase or the plaintext key.
      const provisioned = await vaultCrypto.provisionVault(vaultPassphrase);

      const result = await apiRequest<Parameters<typeof setSession>[0]>("/auth/register", {
        method: "POST",
        body: {
          email,
          password,
          name: name || undefined,
          kdfSalt: provisioned.keyMaterial.kdfSalt,
          kdfIterations: provisioned.keyMaterial.kdfIterations,
          wrappedMasterKey: provisioned.keyMaterial.wrappedMasterKey,
        },
      });

      setSession(result);
      // We already derived the master key locally during provisioning, so
      // there's no need to make the user re-enter the vault passphrase
      // immediately after creating it.
      useAuthStore.setState({ masterKey: provisioned.masterKey });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create your EnvVault account</h1>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Account password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Used to log in. At least 12 characters.</p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
            <Label htmlFor="vault-passphrase">Vault passphrase</Label>
            <Input
              id="vault-passphrase"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={vaultPassphrase}
              onChange={(e) => setVaultPassphrase(e.target.value)}
            />
            <Label htmlFor="vault-passphrase-confirm">Confirm vault passphrase</Label>
            <Input
              id="vault-passphrase-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={vaultPassphraseConfirm}
              onChange={(e) => setVaultPassphraseConfirm(e.target.value)}
            />
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              This is <strong>separate from your account password</strong> and encrypts your files end-to-end.
              EnvVault never has access to it — if you lose it, your encrypted files{" "}
              <strong>cannot be recovered</strong>.
            </p>
          </div>

          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-600 hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
