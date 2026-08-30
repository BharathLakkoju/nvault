import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface shadow-sm", className)}>{children}</div>
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
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        {kicker && (
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{kicker}</div>
        )}
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
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
      className={cn("flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 shadow-sm", className)}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{kicker}</div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}
