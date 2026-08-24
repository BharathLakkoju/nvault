"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/cn";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const masterKey = useAuthStore((s) => s.masterKey);
  const lockVault = useAuthStore((s) => s.lockVault);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            EnvVault
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="focus-ring rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Projects
            </Link>
            <Link
              href="/settings/devices"
              className="focus-ring rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Devices
            </Link>
            <Link
              href="/settings/security"
              className="focus-ring rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Activity
            </Link>
            <span
              className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                masterKey
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
              )}
              title={masterKey ? "Vault unlocked for this session" : "Vault locked — unlock to view or change files"}
            >
              {masterKey ? "Unlocked" : "Locked"}
            </span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="focus-ring ml-2 rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  {user?.email ?? "Account"}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 min-w-[10rem] rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {masterKey && (
                    <DropdownMenu.Item
                      onSelect={() => lockVault()}
                      className="focus-ring cursor-pointer rounded px-2 py-1.5 text-sm text-slate-700 outline-none hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Lock vault
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    onSelect={() => {
                      void logout().then(() => router.replace("/login"));
                    }}
                    className="focus-ring cursor-pointer rounded px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Log out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
