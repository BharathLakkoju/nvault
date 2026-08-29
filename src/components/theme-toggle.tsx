"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { ACCENTS, THEME_MODES, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/cn";

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function ModeIcon({ mode, className }: { mode: ThemeMode; className?: string }) {
  const common = {
    className,
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (mode === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, accent, isDark, setMode, setAccent } = useTheme();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Change theme"
          className={cn(
            "focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-muted dark:hover:bg-ink/[0.06]",
            className,
          )}
        >
          <ModeIcon mode={isDark ? "dark" : "light"} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[70] w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-line dark:bg-surface"
        >
          <DropdownMenu.Label className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-muted">
            Appearance
          </DropdownMenu.Label>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {THEME_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "focus-ring flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs font-medium",
                  mode === m
                    ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-200"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-line dark:text-ink/70 dark:hover:bg-ink/[0.06]",
                )}
              >
                <ModeIcon mode={m} />
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-line" />

          <DropdownMenu.Label className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-muted">
            Accent
          </DropdownMenu.Label>
          <div className="grid grid-cols-7 gap-1 px-1 py-1">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccent(a.id)}
                aria-label={a.label}
                aria-pressed={accent === a.id}
                title={a.label}
                className={cn(
                  "focus-ring flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-white dark:ring-offset-surface",
                  accent === a.id && "ring-2 ring-slate-400 dark:ring-muted",
                )}
              >
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: a.swatch }} />
              </button>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
