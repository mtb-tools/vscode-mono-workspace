/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// eslint-disable-next-line unicorn/import-style
import path from "node:path"
import { parse } from "toml"
import { getWorkspace, WorkspaceProviderType } from "ultra-runner"
import {
  commands,
  ExtensionContext,
  QuickPickItem,
  Uri,
  window,
  extensions,
  OutputChannel,
  workspace as vscodeWorkspace,
  ThemeIcon,
} from "vscode"
import {
  getProjects,
  ProjectConfiguration,
  readWorkspaceConfiguration,
} from "@nrwl/devkit"
import { FsTree } from "nx/src/generators/tree"
import { uniqBy, sortBy } from "lodash"
import { readFile, stat } from "node:fs/promises"
interface WorkspaceFolderItem extends QuickPickItem {
  root: Uri
  emoji?: string
  isRoot?: boolean
  description?: string
}

const output_channel: OutputChannel = window.createOutputChannel(
  "monorepo-workspace"
)

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
  const config = vscodeWorkspace.getConfiguration("monorepoWorkspace.folders")
  if (root == pkgRoot) return config.get<string>("prefix.root") || ""
  const dir = path.relative(root, pkgRoot)

  // Use custom prefixes first
  const custom = config.get<{ regex: string; prefix: string }[]>("custom")
  if (custom?.length) {
    for (const c of custom) {
      if (c.prefix && c.regex && new RegExp(c.regex, "u").test(dir))
        return c.prefix
    }
  }

  for (const type of ["apps", "libs", "tools"]) {
    const regex = config.get<string>(`regex.${type}`)
    const prefix = config.get<string>(`prefix.${type}`)
    if (regex && prefix && new RegExp(regex, "u").test(dir)) return prefix
  }
  return config.get<string>("prefix.unknown") || ""
}

type GetProjectOptions = Partial<{
  cwd: string
  type: WorkspaceProviderType | undefined
  includeRoot: boolean
}>

// async function getFullWorkspace(options: GetProjectOptions) {}

async function getCargoProjects(
  options: GetProjectOptions
): Promise<{ name: string; root: string }[]> {
  const cargo_root = path.join(options.cwd, "Cargo.toml")
  const cargo_worspace_file = await stat(cargo_root)
  const found_root = cargo_worspace_file.isFile()
  if (found_root) {
    const cargo_content = await readFile(cargo_root)
    const content: { workspace: { members: string[] } } = parse(
      cargo_content.toString()
    )

    const projects = await Promise.all(
      content.workspace.members.map(async (member) => {
        const m_root = member
        const m_cargo = path.join(options.cwd, m_root, "Cargo.toml")
        const m_stat = await stat(m_cargo)
        if (m_stat.isFile()) {
          const m_content_raw = await readFile(m_cargo)
          const m_content = parse(m_content_raw.toString())
          // output_channel.appendLine(
          //   `Adding from cargo: ${JSON.stringify(m_content)}`
          // )
          return {
            name: m_content.package?.name,
            root: path.join(options.cwd, m_root),
          }
        }
      })
    )
    return projects
  }
}

function getNxProjects(
  options: GetProjectOptions
): { root: string; projects: { root: string; name: string }[] } {
  const nx_tree = new FsTree(options.cwd, false)
  const nx_proj: Map<string, ProjectConfiguration> = getProjects(nx_tree)

  const nx_ws: { name: string; root: string }[] = []

  for (const project of nx_proj.entries()) {
    nx_ws.push({
      name: project[0],
      root: path.join(options.cwd, project[1].root),
    })
  }
  return {
    projects: nx_ws,
    root: options.cwd,
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
    const workspace = await getMultiProjects(options)
    const nx = getNxProjects(options)
    const cargo = await getCargoProjects(options)
    const ret: WorkspaceFolderItem[] = []
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
        ...workspace
          .getPackages()
          .filter((p) => p.root !== workspace.root)
          .map((p) => {
            return {
              label: `${p.name} (npm workspace)`,
              emoji: `${getFolderEmoji(workspace.root, p.root)}`,
              description: `at ${path.relative(workspace.root, p.root)}`,
              root: Uri.file(p.root),
              isRoot: false,
            }
          })
      )
    }
    if (nx) {
      ret.push(
        ...nx.projects.map((p) => {
          return {
            label: `${p.name} (NX)`,
            emoji: `${getFolderEmoji(nx.root, p.root)}`,
            description: `at ${path.relative(nx.root, p.root)}`,
            root: Uri.file(p.root),
            isRoot: false,
          }
        })
      )
    }
    if (cargo) {
      ret.push(
        ...cargo.map((p) => {
          return {
            label: `${p.name} (Cargo)`,
            emoji: `${getFolderEmoji(cwd, p.root)}`,
            description: `at ${path.relative(cwd, p.root)}`,
            root: Uri.file(p.root),
            isRoot: false,
          }
        })
      )
    }
    const out: WorkspaceFolderItem[] = uniqBy(ret, "root.fsPath").sort((a, b) =>
      a.root.fsPath.localeCompare(b.root.fsPath)
    )

    // output_channel.appendLine(`Found projects: ${JSON.stringify(out)}`)

    return out
  }
}

enum PackageAction {
  newWindow,
  currentWindow,
  workspaceFolder,
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
  const config = vscodeWorkspace.getConfiguration("monorepoWorkspace")
  if (!items) items = await getPackageFolders(config.get("includeRoot"))
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
  if (!items) return

  output_channel.appendLine(
    `${JSON.stringify(items.map((p) => p.root.fsPath))}`
  )
  const itemsSet = new Map(items.map((item) => [item.root.fsPath, item]))
  const folders = vscodeWorkspace.workspaceFolders

  if (folders) {
    for (const folder of folders) {
      if (itemsSet.has(folder.uri.fsPath)) {
        itemsSet.get(folder.uri.fsPath)!.picked = true
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
  context.subscriptions.push(
    commands.registerCommand("extension.openPackageCurrentWindow", () =>
      openPackage(PackageAction.currentWindow)
    ),
    commands.registerCommand("extension.openPackageNewWindow", () =>
      openPackage(PackageAction.newWindow)
    ),
    commands.registerCommand("extension.openPackageWorkspaceFolder", () =>
      openPackage(PackageAction.workspaceFolder)
    ),
    commands.registerCommand("extension.updateAll", () => updateAll()),
    commands.registerCommand("extension.select", () => select())
  )
}

// this method is called when your extension is deactivated
// export function deactivate() {}
