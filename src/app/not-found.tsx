import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/marketing/logo";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Link href="/" className="focus-ring rounded">
        <Logo />
      </Link>
      <p className="mt-10 text-sm font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-slate-600 dark:text-slate-300">
        The page you&apos;re looking for may have moved or never existed.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="focus-ring inline-flex items-center rounded-md bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Back home
        </Link>
        <Link
          href="/dashboard"
          className="focus-ring inline-flex items-center rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
