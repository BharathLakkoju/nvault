import type { Config } from "tailwindcss";

/**
 * Theming model
 * -------------
 * `darkMode: "selector"` — light/dark is driven by a `.dark` class on <html>
 * that the ThemeProvider manages (persisted choice or system preference), not
 * purely by the OS media query. This lets users override their OS setting.
 *
 * The `accent` palette is resolved from CSS custom properties so a user can
 * switch the accent colour at runtime without a rebuild. Each `--accent-*`
 * variable holds an "R G B" channel triple; see globals.css for the palettes.
 */
const accent = (shade: number) => `rgb(var(--accent-${shade}) / <alpha-value>)`;
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "selector",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: accent(50),
          100: accent(100),
          200: accent(200),
          300: accent(300),
          400: accent(400),
          500: accent(500),
          600: accent(600),
          700: accent(700),
        },
        // Semantic surface tokens — light/dark values in globals.css.
        canvas: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        "surface-3": token("surface-3"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
      },
    },
  },
  plugins: [],
};

export default config;
