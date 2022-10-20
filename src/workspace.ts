// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import globrex from "globrex"
import path from "path"
import { Uri } from "vscode"
import { findPackages, getPackage, PackageJsonWithRoot } from "./package"
import { providers, WorkspaceProviderType } from "./providers"
import { checkFileExists } from "./utils"
import { workspace as vscodeWorkspace } from "vscode"
import { log_error } from "./extension"
const defaultOptions = {
  cwd: process.cwd()
    ? Uri.file(process.cwd())
    : vscodeWorkspace.workspaceFolders?.[0].uri || undefined,
  type: undefined as WorkspaceProviderType | undefined,
  includeRoot: false,
}

export type WorkspaceOptions = typeof defaultOptions

export class Workspace {
  packages = new Map<string, PackageJsonWithRoot>()
  roots = new Map<Uri, string>()
  order: string[]

  private constructor(
    public root: Uri,
    packages: PackageJsonWithRoot[],
    public type: WorkspaceProviderType
  ) {
    packages.forEach((p) => {
      if (!p.name) p.name = p.root.fsPath
      this.packages.set(p.name, p)
      this.roots.set(p.root, p.name)
    })

    this.order = []
    ;[...this.packages.entries()].forEach(([name]) => {
      if (!this.order.includes(name)) {
        ;[...this.getDepTree(name), name].forEach(
          (n) => this.order.includes(n) || this.order.push(n)
        )
      }
    })
  }

  async getPackageManager() {
    const pms = {
      npm: ["package-lock.json", "npm-shrinkwrap.json"],
      yarn: ["yarn.lock"],
      pnpm: ["pnpm-lock.yaml"],
    }
    for (const [type, files] of Object.entries(pms)) {
      if (
        files.some(
          async (f) => await checkFileExists(path.resolve(this.root.fsPath, f))
        )
      )
        return type
    }
  }

  static async detectWorkspaceProviders(
    cwd = process.cwd() ? Uri.file(process.cwd()) : undefined
  ) {
    if (cwd === undefined) {
      log_error(`Cannot autodetect workspace without a root. Aborting`)
      return
    }
    const ret: WorkspaceProviderType[] = []
    const types = Object.entries(providers)
    for (const [type, provider] of types) {
      if (["single", "recursive"].includes(type)) continue
      if ((await provider(cwd))?.patterns.length) {
        ret.push(type as WorkspaceProviderType)
      }
    }
    return ret
  }

  static async getWorkspace(_options?: Partial<WorkspaceOptions>) {
    const options: WorkspaceOptions = { ...defaultOptions, ..._options }

    const types = options.type
      ? [options.type]
      : (Object.keys(providers) as WorkspaceProviderType[])

    for (const type of types) {
      const provider = providers[type]
      if (!options.cwd) {
        log_error(`Provider ${type} require a cwd. Aborting.`)
        return
      }
      const info = await provider(options.cwd)
      if (info) {
        if (options.includeRoot) info.patterns.push(".")
        const packages = (await Promise.all(
          (
            await findPackages(info.patterns, {
              cwd: info.root,
              ignore: type == WorkspaceProviderType.recursive ? undefined : [],
            })
          ).map(async (p) => await getPackage(p))
        )) as PackageJsonWithRoot[]
        return new Workspace(info.root, packages, type)
      }
    }
  }

  getPackageForRoot(root: Uri) {
    return this.roots.get(root)
  }

  getDeps(pkgName: string) {
    return Object.keys({
      ...this.packages.get(pkgName)?.dependencies,
      ...this.packages.get(pkgName)?.devDependencies,
    }).filter((dep) => this.packages.has(dep) && dep !== pkgName)
  }

  _getDepTree(pkgName: string, seen: string[] = []) {
    if (seen.includes(pkgName)) return []
    seen.push(pkgName)

    const ret: string[] = []
    this.getDeps(pkgName).forEach((d) => {
      ;[...this._getDepTree(d, seen), d].forEach(
        (dd) => ret.includes(dd) || ret.push(dd)
      )
    })
    return ret
  }

  getDepTree(pkgName: string) {
    const ret = this._getDepTree(pkgName)
    const idx = ret.indexOf(pkgName)
    if (idx >= 0) ret.splice(idx, 1)
    return ret
  }

  async getPackages(filter?: string) {
    let ret = [...this.packages.values()]

    if (filter) {
      const withDeps = filter.startsWith("+")
      let useCwd = false
      if (withDeps) {
        if (filter === "+" || filter === "+.") {
          if (!(await checkFileExists(path.resolve(".", "package.json")))) {
            throw new Error(
              `'--filter +' requires a ./package.json file in the current working directory`
            )
          }
          useCwd = true
        } else {
          filter = filter.slice(1)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const regex: RegExp = globrex(filter, { filepath: true, extended: true })
        .regex
      const names = new Set<string>()
      ret.forEach((p) => {
        if (
          (useCwd && p.root == Uri.file(process.cwd())) ||
          regex.test(p.name || "") ||
          regex.test(
            path.relative(this.root.fsPath, p.root.fsPath).replace(/\\/gu, "/")
          )
        ) {
          names.add(p.name)
          if (withDeps) this.getDepTree(p.name).forEach((dep) => names.add(dep))
        }
      })
      ret = ret.filter((p) => names.has(p.name))
    }
    return ret.sort(
      (a, b) => this.order.indexOf(a.name) - this.order.indexOf(b.name)
    )
  }
}

export async function getWorkspace(options?: Partial<WorkspaceOptions>) {
  return Workspace.getWorkspace(options)
}
