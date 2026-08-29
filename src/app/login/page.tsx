"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuroraBackground } from "@/components/aurora-background";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<Parameters<typeof setSession>[0]>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSession(result);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center px-4">
      <AuroraBackground variant="auth" />
      <div className="fixed right-3 top-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm bg-white/80 p-6 backdrop-blur-sm dark:bg-slate-900/80">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Log in to nvault</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your development environment, available anywhere.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-accent-600 hover:underline dark:text-accent-400">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
