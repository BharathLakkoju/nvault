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

module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      transform: { "^.+\\.tsx?$": tsJest },
      moduleNameMapper,
      testMatch: [
        "<rootDir>/src/**/*.spec.ts",
      ],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      transform: { "^.+\\.tsx?$": tsJest },
      moduleNameMapper,
      testMatch: ["<rootDir>/tests/integration/**/*.spec.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    },
  ],
};
