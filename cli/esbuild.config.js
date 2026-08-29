// Bundles the CLI into a single, dependency-free dist/index.js.
//
// Publishing to npm ships only this bundle: the shared vault crypto
// (imported as "@core/crypto" from the web app's src/lib/crypto) and
// commander are inlined here, so `npm i -g nvault` pulls no transitive
// runtime dependencies and the same crypto code runs in the CLI and the
// browser.
const { build } = require("esbuild");
const { rmSync } = require("node:fs");
const { join } = require("node:path");

rmSync(join(__dirname, "dist"), { recursive: true, force: true });

build({
  entryPoints: [join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: join(__dirname, "dist/index.js"),
  minify: true,
  sourcemap: false,
  // Resolves the "@core/crypto" path mapping.
  tsconfig: join(__dirname, "tsconfig.json"),
  // Node built-ins are external automatically for platform: "node"; nothing
  // else should be — everything the CLI needs gets inlined.
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
