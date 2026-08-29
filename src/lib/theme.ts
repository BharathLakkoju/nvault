/**
 * Theme model
 * -----------
 * Two independent axes the user controls:
 *   - `mode`   — light / dark / system (system follows `prefers-color-scheme`)
 *   - `accent` — the brand/accent colour, swapped via CSS variables
 *
 * The resolved choice is persisted in localStorage and applied to <html> as
 * a `.dark` class (mode) and a `data-accent` attribute (accent). Applying it
 * has to happen before first paint to avoid a flash, so the same logic is
 * inlined as a blocking script in the root layout — keep THEME_INIT_SCRIPT in
 * sync with `applyTheme` / `resolveMode` below.
 */

export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

export interface AccentOption {
  id: string;
  label: string;
  /** A representative swatch colour (accent-500) for UI previews. */
  swatch: string;
}

export const ACCENTS: readonly AccentOption[] = [
  { id: "indigo", label: "Indigo", swatch: "rgb(99 102 241)" },
  { id: "violet", label: "Violet", swatch: "rgb(139 92 246)" },
  { id: "sky", label: "Sky", swatch: "rgb(14 165 233)" },
  { id: "emerald", label: "Emerald", swatch: "rgb(16 185 129)" },
  { id: "amber", label: "Amber", swatch: "rgb(217 119 6)" },
  { id: "rose", label: "Rose", swatch: "rgb(244 63 94)" },
];

export const DEFAULT_MODE: ThemeMode = "system";
export const DEFAULT_ACCENT = "indigo";

export const MODE_STORAGE_KEY = "nvault.theme.mode";
export const ACCENT_STORAGE_KEY = "nvault.theme.accent";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function isAccent(value: unknown): value is string {
  return typeof value === "string" && ACCENTS.some((a) => a.id === value);
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Whether the dark palette should be active for a given mode. */
export function resolveDark(mode: ThemeMode): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark());
}

export function applyTheme(mode: ThemeMode, accent: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = resolveDark(mode);
  root.classList.toggle("dark", dark);
  root.dataset.accent = accent;
  root.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Run `fn` with all CSS transitions/animations suppressed, then restore them on
 * the next frame. Switching the accent changes CSS custom properties that many
 * elements resolve through `transition-colors`; without this, Chromium leaves
 * some of those elements mid-interpolation and they visually lag the switch.
 */
export function withTransitionsDisabled(fn: () => void): void {
  if (typeof document === "undefined") {
    fn();
    return;
  }
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none !important;animation:none !important}"),
  );
  document.head.appendChild(style);
  fn();
  // Force a style flush so the "no transition" rule takes effect for this change.
  window.getComputedStyle(document.body).opacity;
  window.requestAnimationFrame(() => style.remove());
}

export function readStoredMode(): ThemeMode {
  if (typeof localStorage === "undefined") return DEFAULT_MODE;
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    return isThemeMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function readStoredAccent(): string {
  if (typeof localStorage === "undefined") return DEFAULT_ACCENT;
  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccent(raw) ? raw : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/**
 * Blocking script injected into <head> so the theme is applied before the
 * first paint. Mirrors the helpers above; kept dependency-free and tiny.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});
if(m!=="light"&&m!=="dark"&&m!=="system")m=${JSON.stringify(DEFAULT_MODE)};
var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});
var accents=${JSON.stringify(ACCENTS.map((x) => x.id))};
if(accents.indexOf(a)===-1)a=${JSON.stringify(DEFAULT_ACCENT)};
var dark=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;
r.classList.toggle("dark",dark);
r.setAttribute("data-accent",a);
r.style.colorScheme=dark?"dark":"light";
}catch(e){}})();`;
