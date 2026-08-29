import { cn } from "@/lib/cn";

/**
 * Decorative animated background. Purely presentational (`aria-hidden`,
 * `pointer-events-none`) and sits behind content on its own stacking context —
 * the host element needs `relative` (or `isolate`).
 *
 * Movement is applied only through `motion-safe:`, so `prefers-reduced-motion`
 * users see a still gradient. All colour comes from the current accent palette
 * plus a couple of fixed hues that read well against it.
 *
 * Variants:
 *  - `hero`  — blobs weighted toward the top, grid masked to a top ellipse.
 *              Used behind marketing section headers.
 *  - `auth`  — blobs spread around a centred focal point, grid masked to a
 *              centre ellipse. Used behind the login / register cards.
 */
export function AuroraBackground({
  className,
  grid = true,
  variant = "hero",
}: {
  className?: string;
  grid?: boolean;
  variant?: "hero" | "auth";
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {grid && (
        <div className={cn("absolute inset-0 bg-grid", variant === "auth" && "bg-grid-center")} />
      )}

      {variant === "hero" ? (
        <>
          <div className="absolute left-1/2 top-[-6rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-accent-400/25 blur-3xl will-change-transform dark:bg-accent-500/15 motion-safe:animate-[aurora-a_22s_ease-in-out_infinite]" />
          <div className="absolute right-[-8rem] top-[4rem] h-[26rem] w-[26rem] rounded-full bg-sky-400/20 blur-3xl will-change-transform dark:bg-sky-500/10 motion-safe:animate-[aurora-b_26s_ease-in-out_infinite]" />
          <div className="absolute bottom-[-10rem] left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-violet-400/20 blur-3xl will-change-transform dark:bg-violet-500/10 motion-safe:animate-[aurora-c_30s_ease-in-out_infinite]" />
        </>
      ) : (
        <>
          <div className="absolute left-[-6rem] top-[-4rem] h-[28rem] w-[28rem] rounded-full bg-accent-400/25 blur-3xl will-change-transform dark:bg-accent-500/15 motion-safe:animate-[aurora-c_24s_ease-in-out_infinite]" />
          <div className="absolute right-[-8rem] top-[2rem] h-[26rem] w-[26rem] rounded-full bg-sky-400/20 blur-3xl will-change-transform dark:bg-sky-500/10 motion-safe:animate-[aurora-b_28s_ease-in-out_infinite]" />
          <div className="absolute bottom-[-10rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-violet-400/20 blur-3xl will-change-transform dark:bg-violet-500/10 motion-safe:animate-[aurora-a_32s_ease-in-out_infinite]" />
          <div className="absolute bottom-[-6rem] right-[-4rem] h-[22rem] w-[22rem] rounded-full bg-accent-300/20 blur-3xl will-change-transform dark:bg-accent-400/10 motion-safe:animate-[aurora-b_34s_ease-in-out_infinite]" />
        </>
      )}
    </div>
  );
}
