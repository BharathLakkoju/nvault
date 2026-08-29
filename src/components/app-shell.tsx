"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/dashboard", label: "Projects" },
  { href: "/settings/sessions", label: "Sessions" },
  { href: "/settings/tokens", label: "CLI Tokens" },
  { href: "/settings/security", label: "Activity" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const masterKey = useAuthStore((s) => s.masterKey);
  const lockVault = useAuthStore((s) => s.lockVault);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    void logout().then(() => router.replace("/login"));
  };

  const vaultBadge = (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        masterKey
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      )}
      title={masterKey ? "Vault unlocked for this session" : "Vault locked — unlock to view or change files"}
    >
      {masterKey ? "Unlocked" : "Locked"}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="focus-ring rounded text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            nvault
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "focus-ring rounded-md px-3 py-1.5",
                  pathname === link.href
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {link.label}
              </Link>
            ))}
            <span className="ml-2">{vaultBadge}</span>
            <ThemeToggle className="ml-1" />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="focus-ring ml-1 max-w-[12rem] truncate rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  {user?.email ?? "Account"}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
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
                    onSelect={handleLogout}
                    className="focus-ring cursor-pointer rounded px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Log out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </nav>

          {/* Mobile navigation */}
          <div className="flex items-center gap-1 md:hidden">
            {vaultBadge}
            <ThemeToggle />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  aria-label="Open menu"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-[12rem] rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {user?.email && (
                    <div className="truncate px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">{user.email}</div>
                  )}
                  {NAV_LINKS.map((link) => (
                    <DropdownMenu.Item key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          "focus-ring block cursor-pointer rounded px-2 py-1.5 text-sm outline-none",
                          pathname === link.href
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                        )}
                      >
                        {link.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
                  {masterKey && (
                    <DropdownMenu.Item
                      onSelect={() => lockVault()}
                      className="focus-ring cursor-pointer rounded px-2 py-1.5 text-sm text-slate-700 outline-none hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Lock vault
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    onSelect={handleLogout}
                    className="focus-ring cursor-pointer rounded px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Log out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
