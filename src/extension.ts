import path from "node:path"
import { parse as parseToml } from "toml"
import { getWorkspace } from "ultra-runner"
import {
  commands,
  ExtensionContext,
  Uri,
  window,
  OutputChannel,
  workspace as vscodeWorkspace,
} from "vscode"
import { GetProjectOptions, PackageAction, WorkspaceFolderItem } from "./types"
import { getProjects, ProjectConfiguration } from "@nrwl/devkit"
import { FsTree } from "nx/src/generators/tree"
import { uniqBy, get as loGet } from "lodash"
import { readFile, access } from "node:fs/promises"
import { constants as fsconstants, existsSync, PathLike } from "node:fs"
import { getSetting } from "./settings"

type MemberList = {
  name: string
  root: string
}[]
const providers_suffix = (provider: string) => {
  const enabled = getSetting<boolean>("providers_suffix")
  return enabled ? `(${provider.toUpperCase()})` : ""
}
let output_channel: OutputChannel

export const log_error = (msg: string, title?: string) => {
  title = title ? `${title} ` : ""

  output_channel.appendLine(`error: ${title}${msg}`)
}

export const log_hint = (msg: string, title?: string) => {
  title = title ? `${title} ` : ""
  output_channel.appendLine(`hint: ${title}${msg}`)
}

export const log = (msg: string, title?: string) => {
  output_channel.appendLine(`info: ${title}${msg}`)
}

async function checkFileExists(file: PathLike) {
  try {
    await access(file, fsconstants.F_OK)
    return true
  } catch {
    return false
  }
}

const package_description: Record<
  string,
  { access: string; convert: (src: string) => unknown }
> = {
  "Cargo.toml": {
    access: "package.description",
    convert: parseToml,
  },
  "package.json": {
    access: "description",
    convert: JSON.parse,
  },
}

function getFolderDescription(root: string, project_root: string): string {
  return `at ${path.relative(root, project_root)}`
}

async function getFolderDetails(project_root: string): Promise<string> {
  const complex = getSetting<boolean>("fetch_descriptions")
  if (complex) {
    for (const pkg_type in package_description) {
      const pkg = path.join(project_root, pkg_type)
      if (await checkFileExists(pkg)) {
        const cont = await readFile(pkg)
        const cont_parsed = package_description[pkg_type].convert(
          cont.toString()
        )
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

function getFolderEmoji(root: string, pkgRoot: string) {
  // const configg = vscodeWorkspace.getConfiguration()
  // const icon_theme = configg.workbench.iconTheme

  // output_channel.appendLine(
  //   JSON.stringify(
  //     extensions.getExtension("Equinusocio.vsc-community-material-theme")
  //   )
  // )
  // const t = ThemeIcon.File
  //

  if (root == pkgRoot) return getSetting<string>("folders.prefix.root") || ""
  //config.get<string>("prefix.root") || ""
  const dir = path.relative(root, pkgRoot)

  // Use custom prefixes first
  const custom = getSetting<{ regex: string; prefix: string }[]>(
    "folders.custom"
  )
  if (custom?.length) {
    for (const c of custom) {
      if (c.prefix && c.regex && new RegExp(c.regex, "u").test(dir))
        return c.prefix
    }
  }

  for (const type of ["apps", "libs", "tools"]) {
    const regex = getSetting<string>(`folders.regex.${type}`)
    const prefix = getSetting<string>(`folders.prefix.${type}`)
    if (regex && prefix && new RegExp(regex, "u").test(dir)) return prefix
  }
  return getSetting<string>("folders.prefix.unknown") || ""
}

// async function getFullWorkspace(options: GetProjectOptions) {}

export function findUp(name: string, cwd = process.cwd()): string | undefined {
  let up = path.resolve(cwd)
  do {
    cwd = up
    const p = path.resolve(cwd, name)
    if (existsSync(p)) return cwd
    up = path.resolve(cwd, "../")
  } while (up !== cwd)
}

async function getCargoProjects(
  options: GetProjectOptions
): Promise<MemberList> {
  const ws_root = findUp("Cargo.toml", options.cwd)
  if (!ws_root) throw "Root not found"
  log_hint(ws_root, "Gettings Cargo Packages from:")

  const cargo_root = path.join(ws_root, "Cargo.toml")

  if (await checkFileExists(cargo_root)) {
    const cargo_content = await readFile(cargo_root)
    const content: { workspace: { members: string[] } } = parseToml(
      cargo_content.toString()
    ) as { workspace: { members: string[] } }

    const members = content.workspace?.members
      ? await Promise.all(
          content.workspace.members.map(async (member) => {
            const m_root = member
            const m_cargo = path.join(ws_root, m_root, "Cargo.toml")

            if (await checkFileExists(m_cargo)) {
              const m_content_raw = await readFile(m_cargo)
              const m_content: { package: { name: string } } = parseToml(
                m_content_raw.toString()
              ) as { package: { name: string } }

              return {
                name: m_content.package.name,
                root: path.join(ws_root, m_root),
              }
            }
          })
        )
      : []
    if (members) {
      return members.filter((m) => m !== undefined) as MemberList
    }
  }
  return []
}

function getNxProjects(
  options: GetProjectOptions
): { root: string; projects: MemberList } | undefined {
  const nx_root = findUp("nx.json", options.cwd)
  if (!nx_root) return
  const nx_tree = new FsTree(nx_root, false)

  const nx_proj: Map<string, ProjectConfiguration> = getProjects(nx_tree)

  const nx_ws: { name: string; root: string }[] = []

  for (const project of nx_proj.entries()) {
    nx_ws.push({
      name: project[0],
      root: path.join(nx_root, project[1].root),
    })
  }
  return {
    projects: nx_ws,
    root: nx_root,
  }
}

async function getMultiProjects(options: GetProjectOptions) {
  return await getWorkspace(options)
}

async function getPackageFolders(
  includeRoot = true
): Promise<WorkspaceFolderItem[] | undefined> {
  const cwd = vscodeWorkspace.workspaceFolders?.[0].uri.fsPath
  if (cwd) {
    const options = {
      cwd,
      includeRoot: true,
    }
    const ret: WorkspaceFolderItem[] = []
    const nx = getNxProjects(options)
    const core_provider = getSetting<boolean>("providers.core")
    if (core_provider) {
      const workspace = await getMultiProjects(options)
      if (workspace) {
        if (includeRoot)
          ret.push({
            label: `${workspace.getPackageForRoot(workspace.root) || "root"}`,
            emoji: `${getFolderEmoji(workspace.root, workspace.root)}`,
            description: `${
              workspace.type[0].toUpperCase() + workspace.type.slice(1)
            } Workspace Root`,
            root: Uri.file(workspace.root),
            isRoot: true,
          })
        ret.push(
          ...(await Promise.all(
            workspace
              .getPackages()
              .filter((p) => p.root !== workspace.root)
              .map(async (p) => {
                return {
                  label: `${p.name} ${providers_suffix("core")}`,
                  emoji: `${getFolderEmoji(workspace.root, p.root)}`,
                  description: getFolderDescription(workspace.root, p.root),
                  detail: await getFolderDetails(p.root),
                  root: Uri.file(p.root),
                  isRoot: false,
                }
              })
          ))
        )
      }
    }
    const nx_provider = getSetting<boolean>("providers.nx")
    if (nx_provider && nx) {
      ret.push(
        ...(await Promise.all(
          nx.projects.map(async (p) => {
            return {
              label: `${p.name} ${providers_suffix("nx")}`,
              emoji: `${getFolderEmoji(nx.root, p.root)}`,
              description: getFolderDescription(nx.root, p.root),
              detail: await getFolderDetails(p.root),
              root: Uri.file(p.root),
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
                description: getFolderDescription(cwd, p.root),
                detail: await getFolderDetails(p.root),
                root: Uri.file(p.root),
                isRoot: false,
              }
            })
          ))
        )
      }
    }
    const out: WorkspaceFolderItem[] = uniqBy(ret, "root.fsPath").sort((a, b) =>
      a.root.fsPath.localeCompare(b.root.fsPath)
    )

    // output_channel.appendLine(`Found projects: ${JSON.stringify(out)}`)

    return out
  }
}

function addWorkspaceFolder(item: WorkspaceFolderItem) {
  const folders = vscodeWorkspace.workspaceFolders
  let start = 0
  let deleteCount = 0
  if (folders)
    for (const folder of folders) {
      if (folder.uri == item.root) {
        // Nothing to update
        if (folder.name == item.label) return
        deleteCount = 1
        break
      }
      start++
    }
  vscodeWorkspace.updateWorkspaceFolders(start, deleteCount, {
    name: item.label,
    uri: item.root,
  })
}

async function updateAll(items?: WorkspaceFolderItem[], clean = false) {
  if (!items)
    items = await getPackageFolders(getSetting<boolean>("includeRoot"))
  if (!items) return
  const itemsSet = new Set(items.map((item) => item.root.fsPath || item.root))
  const folders = vscodeWorkspace.workspaceFolders
  const adds: { name: string; uri: Uri }[] = []
  if (folders && !clean) {
    adds.push(...folders.filter((f) => !itemsSet.has(f.uri.fsPath)))
  }
  adds.push(
    ...items.map((item) => ({
      name: item.label,
      uri: item.root,
    }))
  )
  vscodeWorkspace.updateWorkspaceFolders(0, folders?.length, ...adds)
}

async function select(items?: WorkspaceFolderItem[]) {
  if (!items) items = await getPackageFolders()
  if (!items) {
    await window.showInformationMessage(
      `VSCode Monoworkspace
You are currently not in a compatible workspace. Open the root folder of your monorepo containing any of:

- package.json
- Cargo.toml
- nx.json

if you think this is an error, please file an issue here:

http://github.com/mtb-tools/vscode-mono-workspace
`,
      {
        modal: true,
      }
    )
    return
  }
  log_hint(
    `${JSON.stringify(items.map((p) => p.root.fsPath))}`,
    "Resolved Packages"
  )
  const itemsSet = new Map(items.map((item) => [item.root.fsPath, item]))
  const folders = vscodeWorkspace.workspaceFolders

  if (folders) {
    for (const folder of folders) {
      if (itemsSet.has(folder.uri.fsPath)) {
        const currentItem = itemsSet.get(folder.uri.fsPath)
        if (currentItem) currentItem.picked = true
      } else {
        items.push({
          root: folder.uri,
          isRoot: false,
          label: folder.name,
          description: "",
          picked: true,
        })
      }
    }
  }
  items = items.map((it) => {
    if (it.emoji) {
      it.label = `${it.emoji} ${it.label}`
    }
    return it
  })

  const picked = await window.showQuickPick(items, {
    canPickMany: true,
    matchOnDescription: true,
  })
  if (picked?.length) return updateAll(picked, true)
}

async function openPackage(action: PackageAction) {
  const items = await getPackageFolders()
  if (items) {
    const item = await window.showQuickPick(items, {
      canPickMany: false,
      matchOnDescription: true,
    })
    if (item) {
      switch (action) {
        case PackageAction.currentWindow: {
          return commands.executeCommand("vscode.openFolder", item.root)
        }
        case PackageAction.newWindow: {
          return commands.executeCommand("vscode.openFolder", item.root, true)
        }
        case PackageAction.workspaceFolder: {
          addWorkspaceFolder(item)
          break
        }
      }
    }
  }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  output_channel = window.createOutputChannel("monorepo-workspace")

  context.subscriptions.push(
    commands.registerCommand("mono-workspace.openPackageCurrentWindow", () =>
      openPackage(PackageAction.currentWindow)
    ),
    commands.registerCommand("mono-workspace.openPackageNewWindow", () =>
      openPackage(PackageAction.newWindow)
    ),
    commands.registerCommand("mono-workspace.openPackageWorkspaceFolder", () =>
      openPackage(PackageAction.workspaceFolder)
    ),
    commands.registerCommand("mono-workspace.updateAll", () => updateAll()),
    commands.registerCommand("mono-workspace.select", () => select())
  )
}

// this method is called when your extension is deactivated
// export function deactivate() {}
