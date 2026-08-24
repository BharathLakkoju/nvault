// Bundles the CLI into a single, dependency-free dist/index.js.
//
// This matters for two reasons: (1) publishing to npm as a scoped package
// with pnpm workspace dependencies would otherwise require @envvault/crypto
// and @envvault/types to *also* be published separately (pnpm rewrites
// "workspace:*" to a real version range at publish time), and (2) `pkg`
// (used to build the standalone binaries — see package.json's
// build:binaries) needs a single entry file to snapshot; it doesn't follow
// pnpm's symlinked workspace node_modules reliably.
const { build } = require("esbuild");
const { rmSync } = require("node:fs");

rmSync("dist", { recursive: true, force: true });

build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/index.js",
  minify: true,
  sourcemap: false,
  // Node built-ins are external automatically for platform: "node"; nothing
  // else should be — everything the CLI needs gets inlined.
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
