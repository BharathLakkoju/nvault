"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/marketing/logo";
import { marketingNav } from "@/lib/site";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  const authenticated = status === "authenticated";
  const primaryHref = authenticated ? "/dashboard" : "/register";
  const primaryLabel = authenticated ? "Open dashboard" : "Get started";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6" aria-label="Main">
        <Link href="/" className="focus-ring rounded" aria-label="nvault home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "focus-ring rounded-md px-3 py-1.5 text-sm",
                pathname === item.href
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!authenticated && (
            <Link
              href="/login"
              className="focus-ring hidden rounded-md px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 sm:inline-flex"
            >
              Log in
            </Link>
          )}
          <Link
            href={primaryHref}
            className="focus-ring hidden rounded-md bg-accent-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-700 sm:inline-flex"
          >
            {primaryLabel}
          </Link>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800 md:hidden">
          <div className="flex flex-col gap-1">
            {marketingNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring rounded-md px-3 py-2 text-sm",
                  pathname === item.href
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
            {!authenticated && (
              <Link href="/login" className="focus-ring rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Log in
              </Link>
            )}
            <Link
              href={primaryHref}
              className="focus-ring rounded-md bg-accent-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-accent-700"
            >
              {primaryLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
