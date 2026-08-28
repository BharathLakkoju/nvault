import { cn } from "@/lib/cn";

/**
 * Decorative animated background for marketing sections. Purely presentational
 * (`aria-hidden`, `pointer-events-none`) and sits behind content on its own
 * stacking context — the host section needs `relative` (or `isolate`).
 *
 * Movement is applied only through `motion-safe:`, so `prefers-reduced-motion`
 * users see a still gradient. All colour comes from the current accent palette.
 */
export function AuroraBackground({
  className,
  grid = true,
}: {
  className?: string;
  grid?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {grid && <div className="absolute inset-0 bg-grid" />}

      <div className="absolute left-1/2 top-[-6rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-accent-400/25 blur-3xl will-change-transform dark:bg-accent-500/15 motion-safe:animate-[aurora-a_22s_ease-in-out_infinite]" />
      <div className="absolute right-[-8rem] top-[4rem] h-[26rem] w-[26rem] rounded-full bg-sky-400/20 blur-3xl will-change-transform dark:bg-sky-500/10 motion-safe:animate-[aurora-b_26s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-10rem] left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-violet-400/20 blur-3xl will-change-transform dark:bg-violet-500/10 motion-safe:animate-[aurora-c_30s_ease-in-out_infinite]" />
    </div>
  );
}
