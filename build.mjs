import esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  target: "node16",
  external: [
    "vscode",
    "@angular-devkit/schematics",
    "@angular-devkit/architect",
    "@angular-devkit/core",
    "rxjs",
    "ts-node",
    "@swc/wasm",
    "@swc/core-darwin-arm64",
    "./remove-old-cache-records.js",
    "../../bin/run-executor.js",
  ],
  mainFields: ["module", "main"],
  minify: true,
  format: "cjs",
  platform: "node",
  outfile: "out/extension.js",
})
