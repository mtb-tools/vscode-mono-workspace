import path from "path"
import { log_hint } from "../extension"
import { GetProjectOptions, MonoworkspaceMember } from "../types"
import { findUp, readFile } from "../utils"
import { Uri, workspace as vscodeWorkspace } from "vscode"
import json from "json5"

export async function parseNX(
  nx: string
): Promise<{ name: string; root: Uri }[]> {
  const nx_file = path.join(nx, "nx.json")
  const ws_file = path.join(nx, "workspace.json")
  log_hint(`Parsing ${nx_file}: ${await readFile(nx_file)}`)

  const nx_content = json.parse(await readFile(nx_file))
  log_hint(`Parsed ${nx_file}`)

  const appDirs = nx_content.workspaceLayout?.appsDir || "apps"
  const libDirs = nx_content.workspaceLayout?.libsDir || "libs"

  const ws_content = JSON.parse(await readFile(ws_file))
  const projects = ws_content.projects
  if (!projects) return []

  return Object.keys(projects).map((key) => {
    return { name: key, root: Uri.file(path.join(nx, projects[key])) }
  })
}

export async function getNxProjects(
  options: GetProjectOptions
): Promise<{ root: Uri; projects: MonoworkspaceMember[] } | undefined> {
  const nx_root = await findUp("workspace.json", options.cwd?.fsPath)
  if (!nx_root) return
  // const nx_tree = new FsTree(nx_root, false)

  const nx_ws: { name: string; root: Uri }[] = await parseNX(nx_root)
  // log_hint(`Found NX Projects: ${JSON.stringify(projs)}`)

  // const nx_proj: Map<string, ProjectConfiguration> = getProjects(nx_tree)

  // const nx_ws: { name: string; root: string }[] = []

  // for (const project of nx_proj.entries()) {
  //   nx_ws.push({
  //     name: project[0],
  //     root: path.join(nx_root, project[1].root),
  //   })
  // }

  // log_hint(`${JSON.stringify(nx_ws)}`)

  return {
    projects: nx_ws,
    root: Uri.file(nx_root),
  }
}
