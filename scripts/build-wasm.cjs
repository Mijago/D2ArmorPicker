// Compiles the shared kernels (src/kernels) to WASM. The app falls back to the same sources as
// plain TypeScript when the .wasm is missing or fails to load, so a failed build is not fatal.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const out = path.join(root, "src", "assets", "wasm", "kernels.wasm");
fs.mkdirSync(path.dirname(out), { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "assemblyscript", "bin", "asc.js"),
    path.join("src", "kernels", "wasm-entry.ts"),
    "--outFile",
    path.relative(root, out),
    "--optimizeLevel",
    "3",
    "--shrinkLevel",
    "0",
    // Kernels never allocate per call, so the bump allocator suffices; the incremental GC and
    // bounds checks cost several times the runtime of these loops.
    "--runtime",
    "stub",
    "--uncheckedBehavior",
    "always",
    "--noAssert",
  ],
  { cwd: root, stdio: "inherit" }
);

if (result.status !== 0) {
  console.error("WASM kernel build failed; the app will use the TypeScript fallback.");
  process.exit(result.status ?? 1);
}
console.log(`kernels.wasm: ${(fs.statSync(out).size / 1024).toFixed(1)} KiB`);
