import { parse as parseToml } from "toml"
import json from "json5"
import { getFolderEmoji, getSetting } from "./settings"
import path from "path"
import { checkFileExists, readFile } from "./utils"
// import { readFile } from "node:fs/promises"
import { get as loGet, uniqBy } from "lodash"
import { WorkspaceFolderItem } from "./types"
import { getCargoProjects } from "./providers/cargo"
import { Uri, workspace as vscodeWorkspace } from "vscode"
import { getNxProjects } from "./providers/nx"
import { getMultiProjects } from "./providers/core"
import { log_hint } from "./extension"
// import { performance } from "perf_hooks"

export async function getPackageFolders(
  includeRoot = true
): Promise<WorkspaceFolderItem[] | undefined> {
  const cwd = vscodeWorkspace.workspaceFolders?.[0].uri
  if (cwd) {
    const options = {
      cwd,
      includeRoot: true,
    }
    const ret: WorkspaceFolderItem[] = []

    log_hint(`Check if core is required`)
    const core_provider = getSetting<boolean>("providers.core")
    if (core_provider) {
      log_hint(`Getting core projects`)
      // var start = performance.now()
      const workspace = await getMultiProjects(options)
      // var end = performance.now()
      // var time = end - start
      // log_hint("Resolving core packages took: " + time / 1000 + "s")

      if (workspace) {
        if (includeRoot)
          ret.push({
            label: `${workspace.getPackageForRoot(workspace.root) || "root"}`,
            emoji: `${getFolderEmoji(workspace.root, workspace.root)}`,
            description: `${
              workspace.type[0].toUpperCase() + workspace.type.slice(1)
            } Workspace Root`,
            root: workspace.root,
            isRoot: true,
          })
        ret.push(
          ...(await Promise.all(
            (await workspace.getPackages())
              .filter((p) => p.root !== workspace.root)
              .map(async (p) => {
                return {
                  label: `${p.name} ${providers_suffix("core")}`,
                  emoji: `${getFolderEmoji(workspace.root, p.root)}`,
                  root: p.root,
                  isRoot: false,
                }
              })
          ))
        )
      }
    }
    log_hint(`Getting NX Projects if any.`)
    const nx = await getNxProjects(options)
    const nx_provider = getSetting<boolean>("providers.nx")
    if (nx_provider && nx) {
      ret.push(
        ...(await Promise.all(
          nx.projects.map(async (p) => {
            return {
              label: `${p.name} ${providers_suffix("nx")}`,
              emoji: `${getFolderEmoji(nx.root, p.root)}`,
              root: p.root,
              isRoot: false,
            }
          })
        ))
      )
    }
    const cargo_provider = getSetting<boolean>("providers.cargo")
    if (cargo_provider) {
      const cargo = await getCargoProjects(options)

      if (cargo) {
        ret.push(
          ...(await Promise.all(
            cargo.map(async (p) => {
              return {
                label: `${p.name} ${providers_suffix("cargo")}`,
                emoji: `${getFolderEmoji(cwd, p.root)}`,
                root: p.root,
                isRoot: false,
              }
            })
          ))
        )
      }
    }
    const out: WorkspaceFolderItem[] = await Promise.all(
      uniqBy(ret, "root.fsPath")
        .sort((a, b) => a.root.fsPath.localeCompare(b.root.fsPath))
        .map(async (e) => {
          e.description = getFolderDescription(cwd, e.root)
          e.detail = await getFolderDetails(e.root)
          return e
        })
    )

    // output_channel.appendLine(`Found projects: ${JSON.stringify(out)}`)

    return out
  }
}

function getFolderDescription(root: Uri, project_root: Uri): string {
  return `at ${path.relative(root.fsPath, project_root.fsPath)}`
}

export const package_description: Record<
  string,
  { access: string; convert: (src: string) => unknown }
> = {
  "Cargo.toml": {
    access: "package.description",
    convert: parseToml,
  },
  "package.json": {
    access: "description",
    // eslint-disable-next-line @typescript-eslint/unbound-method
    convert: json.parse,
  },
}

/// formats the providers for the QuickPick
export const providers_suffix = (provider: string) => {
  const enabled = getSetting<boolean>("providers_suffix")
  return enabled ? `(${provider.toUpperCase()})` : ""
}

export async function getFolderDetails(project_root: Uri): Promise<string> {
  const complex = getSetting<boolean>("fetch_descriptions")
  if (complex) {
    log_hint(
      `Getting descriptions for packages ${path.basename(project_root.fsPath)}.`
    )
    for (const pkg_type in package_description) {
      const pkg = path.join(project_root.fsPath, pkg_type)

      if (await checkFileExists(pkg)) {
        const cont = await readFile(pkg)
        const cont_parsed = package_description[pkg_type].convert(cont)
        const cont_description = loGet(
          cont_parsed,
          package_description[pkg_type].access
        ) as string

        if (cont_description) {
          return cont_description
        }
      }
    }
  }

  return ""
}
