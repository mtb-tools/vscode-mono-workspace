import esbuild from "esbuild"
import { readFile } from "fs/promises"
import { jsonc } from "jsonc"

const pkg = await readFile("./package.json")
const pkg_parsed = jsonc.parse(pkg.toString())
console.log(pkg_parsed.devDependencies)
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
    ...Object.keys(pkg_parsed.devDependencies),
  ],
  mainFields: ["module", "main"],
  minify: true,
  format: "cjs",
  platform: "node",
  outfile: "out/extension.js",
})
