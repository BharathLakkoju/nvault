import { cn } from "@/lib/cn";

/** Shield-and-keyhole brand mark. Colour follows the current accent palette. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("h-6 w-6 text-accent-600 dark:text-accent-400", className)}
    >
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" fill="currentColor" />
      <circle cx="12" cy="10" r="2.2" className="fill-white dark:fill-slate-950" />
      <rect x="10.9" y="10" width="2.2" height="4.6" rx="1.1" className="fill-white dark:fill-slate-950" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-slate-900 dark:text-slate-100">EnvVault</span>
    </span>
  );
}
