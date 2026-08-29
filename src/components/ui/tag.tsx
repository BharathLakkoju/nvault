import { cn } from "@/lib/cn";

type Variant = "accent" | "neutral" | "outline" | "warning" | "success";

const variantClasses: Record<Variant, string> = {
  accent: "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  outline: "border border-accent-300 text-accent-700 dark:border-accent-800 dark:text-accent-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  success: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
