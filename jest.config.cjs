/** @type {import('jest').Config} */
const tsJest = [
  "ts-jest",
  {
    tsconfig: {
      module: "commonjs",
      moduleResolution: "node",
      esModuleInterop: true,
      jsx: "react-jsx",
      types: ["node", "jest"],
    },
  },
];

const moduleNameMapper = { "^@/(.*)$": "<rootDir>/src/$1" };

// The standalone CLI package (cli/) has its own jest config and also a
// package.json named "envvault" — ignore it here so Haste doesn't see a
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
  ],
};
