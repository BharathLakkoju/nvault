"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  applyTheme,
  readStoredAccent,
  readStoredMode,
  resolveDark,
  withTransitionsDisabled,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: string;
  /** Whether the dark palette is currently active (mode resolved against the OS). */
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from the defaults so server and first client render agree; the real
  // stored values are read in the effect below (the inline head script has
  // already applied them to <html>, so there is no visual flash).
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setModeState(readStoredMode());
    setAccentState(readStoredAccent());
  }, []);

  useEffect(() => {
    withTransitionsDisabled(() => applyTheme(mode, accent));
    setIsDark(resolveDark(mode));
  }, [mode, accent]);

  // Track OS changes while in "system" mode.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      withTransitionsDisabled(() => applyTheme("system", accent));
      setIsDark(mql.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode, accent]);

  // Reflect changes made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MODE_STORAGE_KEY) setModeState(readStoredMode());
      if (e.key === ACCENT_STORAGE_KEY) setAccentState(readStoredAccent());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — in-memory only */
    }
  }, []);

  const setAccent = useCallback((next: string) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — in-memory only */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, accent, isDark, setMode, setAccent }),
    [mode, accent, isDark, setMode, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
