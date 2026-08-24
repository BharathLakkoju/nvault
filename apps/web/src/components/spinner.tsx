export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
