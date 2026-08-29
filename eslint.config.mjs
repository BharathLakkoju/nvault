import reactHooks from "eslint-plugin-react-hooks";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config (ESLint 9 / Next 16 — `next lint` and .eslintrc are gone).
// `eslint-config-next/core-web-vitals` already bundles the Next, React and
// TypeScript rule sets.
const config = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "**/*.spec.ts",
      "tests/**",
      "src/generated/**",
      ".next/**",
      "cli/dist/**",
      "next-env.d.ts",
    ],
  },
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // New in eslint-plugin-react-hooks v7 (pulled in by Next 16's config).
      // It flags the "hydrate state from localStorage / reset on dep change"
      // effects this app uses deliberately; keep it visible as a warning
      // rather than rewriting those components in a dependency bump.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
