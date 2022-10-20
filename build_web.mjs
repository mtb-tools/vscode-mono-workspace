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
  external: ["vscode", ...Object.keys(pkg_parsed.devDependencies)],
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
