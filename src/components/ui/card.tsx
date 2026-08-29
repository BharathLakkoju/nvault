import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  kicker,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  kicker?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        {kicker && (
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-accent-600 dark:text-accent-400">
            {kicker}
          </div>
        )}
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A compact stat card — a small uppercase kicker over a large value. */
export function StatCard({
  kicker,
  value,
  className,
}: {
  kicker: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-accent-600 dark:text-accent-400">
        {kicker}
      </div>
      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
