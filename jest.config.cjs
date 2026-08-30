/** @type {import('jest').Config} */
const tsJest = [
  "ts-jest",
  {
    tsconfig: {
      // ts-jest compiles specs to CommonJS for the Node test runner.
      // `nodenext` replaces the classic `node` (aka `node10`) resolution,
      // which TypeScript 6 rejects outright.
      module: "nodenext",
      moduleResolution: "nodenext",
      esModuleInterop: true,
      jsx: "react-jsx",
      types: ["node", "jest"],
    },
  },
];

const moduleNameMapper = { "^@/(.*)$": "<rootDir>/src/$1" };

// The CLI package imports the shared vault crypto / filename schema through
// these aliases (see cli/tsconfig.json). The CLI ⇄ API integration project
// needs them resolvable too, alongside the app's own `@/` alias.
const cliModuleNameMapper = {
  ...moduleNameMapper,
  "^@core/crypto$": "<rootDir>/src/lib/crypto/index.ts",
  "^@core/filename$": "<rootDir>/src/lib/schemas/filename.ts",
};

// The standalone CLI package (cli/) has its own jest config and also a
// package.json named "@lbharath/nvault" — ignore it here so Haste doesn't see a
// naming collision and so `pnpm test` never picks up its specs.
const ignoreCli = ["<rootDir>/cli/"];

module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      transform: { "^.+\\.tsx?$": tsJest },
      moduleNameMapper,
      modulePathIgnorePatterns: ignoreCli,
      testPathIgnorePatterns: ignoreCli,
      testMatch: [
        "<rootDir>/src/**/*.spec.ts",
      ],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      transform: { "^.+\\.tsx?$": tsJest },
      moduleNameMapper,
      modulePathIgnorePatterns: ignoreCli,
      testPathIgnorePatterns: ignoreCli,
      testMatch: ["<rootDir>/tests/integration/**/*.spec.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    },
    {
      // CLI ⇄ API: runs the real cli/src command functions against the real
      // Route Handlers + Postgres. Unlike the other projects this one must be
      // able to import from cli/, so it only ignores cli/node_modules (to keep
      // Haste from seeing duplicate vendored packages).
      displayName: "cli-integration",
      testEnvironment: "node",
      transform: { "^.+\\.tsx?$": tsJest },
      moduleNameMapper: cliModuleNameMapper,
      modulePathIgnorePatterns: ["<rootDir>/cli/node_modules/", "<rootDir>/cli/dist/"],
      testPathIgnorePatterns: ["<rootDir>/cli/"],
      testMatch: ["<rootDir>/tests/cli-integration/**/*.spec.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    },
  ],
};
