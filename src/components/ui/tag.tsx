import { cn } from "@/lib/cn";

type Variant = "accent" | "neutral" | "outline" | "warning" | "success";

const variantClasses: Record<Variant, string> = {
  accent: "bg-accent-500/15 text-accent-700 dark:text-accent-200",
  neutral: "bg-ink/[0.08] text-ink/80",
  outline: "border border-accent-500 text-accent-600 dark:text-accent-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function Tag({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] tracking-[0.02em]",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
