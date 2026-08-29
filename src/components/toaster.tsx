"use client";

import { useToastStore } from "@/lib/toast-store";
import { cn } from "@/lib/cn";

const kindClasses = {
  success: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
  error: "border-red-500/50 text-red-700 dark:text-red-300",
  info: "border-line text-ink",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-xl",
            kindClasses[t.kind],
          )}
        >
          <span>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-auto text-xs opacity-70 hover:opacity-100 focus-ring rounded"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
