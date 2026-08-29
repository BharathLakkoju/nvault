/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/**/*.spec.ts"],
  moduleNameMapper: {
    "^@core/crypto$": "<rootDir>/../src/lib/crypto/index.ts",
    "^@core/filename$": "<rootDir>/../src/lib/schemas/filename.ts",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
};
