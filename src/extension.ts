import path from "node:path"
import {
  commands,
  ExtensionContext,
  Uri,
  window,
  OutputChannel,
  // ConfigurationTarget,
  workspace as vscodeWorkspace,
} from "vscode"
import { jsonc as json } from "jsonc"
import {
  ExtensionOptions,
  MonoworkspaceMember,
  PackageAction,
  WorkspaceFolderItem,
} from "./types"
import { readFile, writeFile } from "node:fs/promises"
import { getSetting } from "./settings"
import { checkFileExists } from "./utils"
import { getPackageFolders } from "./pkg"
import { getMultiProjects } from "./providers/core"
// import { logUtils } from "./utils"

/// globals
let output_channel: OutputChannel

export const log_error = (msg: string, title?: string) => {
  output_channel.appendLine(`error: ${title || ""}${msg}`)
}

export const log_hint = (msg: string, title?: string) => {
  output_channel.appendLine(`hint: ${title || ""}${msg}`)
}

export const log = (msg: string, title?: string) => {
  output_channel.appendLine(`info: ${title || ""}${msg}`)
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
async function saveSet() {
  log_hint("Saving current set")
  const current_set = vscodeWorkspace.workspaceFolders || []
  const pth = vscodeWorkspace.workspaceFolders?.[0].uri.fsPath
  const workspace = await getMultiProjects({ cwd: pth, includeRoot: true })
  const set_name = await window.showInputBox({
    ignoreFocusOut: true,
    prompt: "Choose a name for the current set",
  })
  if (!set_name || set_name === "") {
    await window.showErrorMessage("No name provided")
    return
  }
  if (workspace) {
    log_hint(`Found workspace at ${workspace.root}`)
    const root = path.join(workspace.root, ".vscode", "settings.json")
    let existing_sets: { name: string; members: MonoworkspaceMember[] }[] = []
    let root_settings: { monoWorkspace?: ExtensionOptions } = {}
    if (await checkFileExists(root)) {
      const root_settings_raw = await readFile(root)
      log_hint(
        `Read settings ${root}, with content: ${root_settings_raw.toString()}`
      )

      root_settings = json.parse(root_settings_raw.toString()) as {
        monoWorkspace?: ExtensionOptions
      }

      log_hint(`Found ${json.stringify(root_settings)}`)
      existing_sets = root_settings.monoWorkspace?.sets || []
    }
    if (!root_settings.monoWorkspace) root_settings.monoWorkspace = {}

    root_settings.monoWorkspace.sets = [
      {
        name: set_name,
        members: current_set.map((f) => {
          return {
            name: f.name,
            root: f.uri.fsPath,
          }
        }),
      },
      ...existing_sets,
    ]

    //const old_sets = vscodeWorkspace.getConfiguration("monoWorkspace.sets")

    await writeFile(root, json.stringify(root_settings, { space: 4 }))
    await window.showInformationMessage("Monoworkspace config has been updated")
    return
  }
  await window.showWarningMessage("You are not in a monoworkspace")
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
    `${json.stringify(items.map((p) => p.root.fsPath))}`,
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
    commands.registerCommand(" mono-workspace.openPackageWorkspaceFolder", () =>
      openPackage(PackageAction.workspaceFolder)
    ),
    commands.registerCommand("mono-workspace.updateAll", () => updateAll()),
    // commands.registerCommand("mono-workspace.save_set", () => saveSet()),
    commands.registerCommand("mono-workspace.select", () => select())
  )
}

// this method is called when your extension is deactivated
// export function deactivate() {}
