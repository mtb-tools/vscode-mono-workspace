import esbuild from "esbuild"
import { readFile } from "fs/promises"
import json from "json5"

const pkg = await readFile("./package.json")
const pkg_parsed = json.parse(pkg.toString())

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  target: "node16",
  treeShaking: true,
  external: [
    "vscode",
    "@angular-devkit/schematics",
    "@angular-devkit/architect",
    "@angular-devkit/core",
    "rxjs",
    "ts-node",
    "@swc/wasm",
    "@swc-node",
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
