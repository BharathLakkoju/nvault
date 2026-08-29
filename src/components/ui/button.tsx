"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

/**
 * Nocturne actions: the primary is an accent *outline* on a transparent
 * ground (never a flood), secondary is a hairline on the surface, ghost is
 * text-only. Every variant carries a themed hover + pressed tint.
 */
const variantClasses: Record<Variant, string> = {
  primary:
    "border border-accent-500 text-accent-600 dark:text-accent-300 hover:bg-accent-500/10 active:bg-accent-500/20 disabled:text-accent-400",
  secondary:
    "border border-line text-ink hover:bg-ink/[0.06] active:bg-ink/[0.12]",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-400",
  ghost:
    "text-accent-600 dark:text-accent-300 hover:bg-accent-500/10 active:bg-accent-500/20",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
