import esbuild from "esbuild"
import { readFile } from "fs/promises"
import json from "json5"
import * as poly from "@esbuild-plugins/node-modules-polyfill"
import * as glb from "@esbuild-plugins/node-globals-polyfill"

const pkg = await readFile("./package.json")
const pkg_parsed = json.parse(pkg.toString())
const dev = process.argv.includes("-dev")
await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  target: ["es2020"],
  sourcemap: dev,
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
    "perf_hooks",
    ...Object.keys(pkg_parsed.devDependencies),
  ],
  treeShaking: true,
  minify: !dev,
  format: "cjs",
  platform: "browser",
  outfile: "out/extension-web.js",
  plugins: [
    poly.NodeModulesPolyfillPlugin(),
    glb.NodeGlobalsPolyfillPlugin({
      process: true,
      buffer: true,
      path: true,
    }),
  ],
})
