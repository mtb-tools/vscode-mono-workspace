import path from "path"
import json from "json5"
import { findUp, getPackage } from "../package"
import { Uri } from "vscode"
import { readFile } from "../utils"
import { log_hint } from "../extension"

export enum WorkspaceProviderType {
  single = "single",
  lerna = "lerna",
  yarn = "yarn",
  pnpm = "pnpm",
  rush = "rush",
  recursive = "recursive",
}

type WorkspaceProviderInfo = { root: Uri; patterns: string[] } | undefined

type WorkspaceProvider = (
  cwd: Uri
) => WorkspaceProviderInfo | Promise<WorkspaceProviderInfo>

export const providers: Record<WorkspaceProviderType, WorkspaceProvider> = {
  yarn: async (cwd) => {
    log_hint("Getting Yarn")
    let root = await findUp("package.json", cwd.fsPath)
    while (root) {
      const pkg = await getPackage(root)
      if (pkg?.workspaces) {
        if (Array.isArray(pkg.workspaces))
          return { root: Uri.file(root), patterns: pkg.workspaces }
        if (Array.isArray(pkg.workspaces.packages))
          return { root: Uri.file(root), patterns: pkg.workspaces.packages }
      }

      root = await findUp(
        "package.json",
        path.resolve(path.dirname(root), "..")
      )
    }
  },

  pnpm: async (cwd) => {
    log_hint("Getting PNPM")
    const yaml = await import("yamljs")
    const root = await findUp("pnpm-workspace.yaml", cwd.fsPath)
    if (root) {
      const y = yaml.parse(
        await readFile(path.resolve(root, "pnpm-workspace.yaml"))
      )
      if (y.packages) return { root: Uri.file(root), patterns: y.packages }
    }
  },

  lerna: async (cwd) => {
    log_hint("Getting Lerna")
    const root = await findUp("lerna.json", cwd.fsPath)
    if (root) {
      const fl = await readFile(Uri.file(path.resolve(root, "lerna.json")))
      return {
        root: Uri.file(root),
        patterns: json.parse(fl.toString()).packages as string[],
      }
    }
  },

  rush: async (cwd) => {
    log_hint("Getting Rush")
    const root = await findUp("rush.json", cwd.fsPath)

    if (root) {
      return {
        root: Uri.file(root),
        patterns: json
          .parse(await readFile(path.resolve(root, "rush.json")))
          ?.projects.map((p: { projectFolder?: string }) => p.projectFolder),
      }
    }
  },

  recursive: (cwd) => {
    log_hint("Getting Recursive")
    return { root: cwd, patterns: ["*/**"] }
  },

  single: async (cwd) => {
    log_hint("Getting Single")
    const root = await findUp("package.json", cwd.fsPath)
    if (root) return { root: Uri.file(root), patterns: [root] }
  },
}
