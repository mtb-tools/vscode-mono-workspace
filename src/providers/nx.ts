import path from "path"
import { log_hint } from "../extension"
import { GetProjectOptions, MonoworkspaceMember } from "../types"
import { findUp, readFile } from "../utils"
import { Uri, workspace as vscodeWorkspace } from "vscode"
import json from "json5"

export async function parseNxWorkspace(
  nx: string
): Promise<{ name: string; root: Uri }[]> {
  const nx_file = path.join(nx, "nx.json")
  const ws_file = path.join(nx, "workspace.json")
  log_hint(`Parsing ${nx_file}: ${await readFile(nx_file)}`)

  const nx_content = json.parse(await readFile(nx_file))
  log_hint(`Parsed ${nx_file}`)

  const ws_content = JSON.parse(await readFile(ws_file))
  const projects = ws_content.projects
  if (!projects) return []

  return Object.keys(projects).map((key) => {
    return { name: key, root: Uri.file(path.join(nx, projects[key])) }
  })
}

async function getNxProjects(filesPaths: string[]) {
  const projects = filesPaths.map((f) => ({
    name: path.basename(path.dirname(f)),
    root: Uri.file(
      path.join(
        vscodeWorkspace.workspaceFolders![0].uri.path,
        f.replace("/project.json", "").split("/").slice(-2).join("/")
      )
    ),
  }))

  log_hint(`Found ${projects.length} projects.`)

  return projects
}

export async function getNxAppsAndLibs(
  options: GetProjectOptions
): Promise<{ root: Uri; projects: MonoworkspaceMember[] } | undefined> {
  const [nxWorkspace] = await vscodeWorkspace.findFiles("./workspace.json")
  const nxProjects = await vscodeWorkspace.findFiles(
    "**/project.json",
    "**/node_modules/**"
  )

  if (nxWorkspace) {
    const nx_ws = await parseNxWorkspace(nxWorkspace.fsPath)
    return {
      projects: nx_ws,
      root: Uri.file(nxWorkspace.fsPath),
    }
  }

  // handle new Nx format with project.json
  if (nxProjects.length > 0) {
    log_hint(`Found ${nxProjects.length} project.json files`)
    const projects = await getNxProjects(nxProjects.map((f) => f.fsPath))

    return {
      projects,
      root: Uri.file(vscodeWorkspace.workspaceFolders![0].uri.path),
    }
  }

  return undefined
  // if (!nxWorkspace) return
  // const nx_tree = new FsTree(nx_root, false)

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
}
