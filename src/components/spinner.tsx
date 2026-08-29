import { cn } from "@/lib/cn";

/** A small inline spinner. Size it with a `h-*`/`w-*` className (default 1rem). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-muted">
        <Spinner className="h-8 w-8" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
