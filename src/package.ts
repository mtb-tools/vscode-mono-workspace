import { Uri, workspace as vscodeWorkspace } from "vscode"
import path from "path"
import { PackageJson as PJson } from "type-fest"
import { checkFileExists, findFiles, readFile } from "./utils"
import { log_hint } from "./extension"

export type PackageJson = PJson & {
  name: string
  ultra?: {
    concurrent?: string[]
  }
}

export type PackageJsonWithRoot = PackageJson & {
  root: Uri
}

interface FindPackagesOption {
  includeRoot?: boolean
  ignore?: string[]
  cwd?: Uri
}

const BASIC_IGNORE = ["**/node_modules/**", "**/bower_components/**"]

const DEFAULT_IGNORE = ["**/test/**", "**/tests/**", "**/__tests__/**"]

export async function findPackages(
  patterns: string[],
  options?: FindPackagesOption
): Promise<Uri[]> {
  log_hint("Running Fast Glob")

  //const fastGlob = (await import("fast-glob")).default
  if (!options) options = {}

  if (!options.ignore) options.ignore = DEFAULT_IGNORE
  options.ignore.push(...BASIC_IGNORE)

  if (options.includeRoot) patterns.push(".")

  patterns = patterns.map((pattern) =>
    pattern.replace(/\/?$/u, "/package.json")
  )

  // return (await fastGlob(patterns, options)).map((file) =>
  //   path.resolve(options?.cwd || process.cwd(), dirname(file))
  // )

  return (await Promise.all(patterns.map(async (p) => await findFiles(p))))
    .flat()
    .map(
      (file) => Uri.file(path.dirname(file.fsPath))
      //path.resolve(options?.cwd || process.cwd(), dirname(file))
    )
}

export async function findUp(
  name: string,
  cwd = process.cwd()
): Promise<string | undefined> {
  let up = path.resolve(cwd)
  do {
    cwd = up
    const p = path.resolve(cwd, name)
    if (await checkFileExists(p)) return cwd
    up = path.resolve(cwd, "../")
  } while (up !== cwd)
}

export async function getPackage(
  root: Uri | string
): Promise<PackageJsonWithRoot | undefined> {
  if (typeof root === "string") {
    root = Uri.file(root)
  }
  log_hint(`Getting package from ${root.fsPath}`)
  const pkgPath = path.resolve(root.fsPath, "package.json")
  if (await checkFileExists(pkgPath)) {
    const pkg_raw = await readFile(Uri.file(pkgPath))

    const pkg = JSON.parse(pkg_raw) as PackageJsonWithRoot
    log_hint(`Package: ${pkg}`)
    if (!pkg.name) pkg.name = root.fsPath
    pkg.root = root
    return pkg
  }
}
