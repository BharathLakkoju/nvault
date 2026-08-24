// Builds standalone, dependency-free executables for every supported
// platform — the same command this project's CI release workflow runs
// (.github/workflows/cli-release.yml), kept here so `pnpm run
// build:binaries` reproduces identical output locally. Cross-compiles all
// four targets from whatever OS you run this on (verified working from
// Linux); `pkg` downloads the matching prebuilt Node base binary per target.
const { execFileSync } = require("node:child_process");
const { mkdirSync } = require("node:fs");

const TARGETS = [
  ["node20-linux-x64", "binaries/envvault-linux-x64"],
  ["node20-macos-x64", "binaries/envvault-macos-x64"],
  ["node20-macos-arm64", "binaries/envvault-macos-arm64"],
  ["node20-win-x64", "binaries/envvault-win-x64.exe"],
];

mkdirSync("binaries", { recursive: true });

for (const [target, output] of TARGETS) {
  console.log(`Building ${output} (${target})...`);
  execFileSync("npx", ["pkg", "bin/envvault.js", "--targets", target, "--output", output], {
    stdio: "inherit",
  });
}

console.log("\nDone. See apps/cli/binaries/");
