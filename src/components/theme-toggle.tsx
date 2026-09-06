"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { ACCENTS, THEME_MODES, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/cn";

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const MODE_ICONS: Record<ThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, accent, isDark, setMode, setAccent } = useTheme();
  const TriggerIcon = isDark ? Moon : Sun;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Change theme"
          className={cn(
            "focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06]",
            className,
          )}
        >
          <TriggerIcon size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[70] w-60 rounded-lg border border-line bg-surface p-2 shadow-xl"
        >
          <DropdownMenu.Label className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted">
            Appearance
          </DropdownMenu.Label>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {THEME_MODES.map((m) => {
              const Icon = MODE_ICONS[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "focus-ring flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs font-medium",
                    mode === m
                      ? "border-accent-500 bg-accent-500/10 text-accent-700 dark:bg-accent-500/15 dark:text-accent-200"
                      : "border-line text-ink/70 hover:bg-ink/[0.06]",
                  )}
                >
                  <Icon size={16} />
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          <DropdownMenu.Label className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted">
            Accent
          </DropdownMenu.Label>
          <div className="grid grid-cols-6 gap-1 px-1 py-1">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccent(a.id)}
                aria-label={a.label}
                aria-pressed={accent === a.id}
                title={a.label}
                className={cn(
                  "focus-ring flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface",
                  accent === a.id && "ring-2 ring-muted",
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
