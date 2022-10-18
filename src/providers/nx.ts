import { getProjects, ProjectConfiguration } from "@nrwl/devkit"
import { FsTree } from "nx/src/generators/tree"
import path from "node:path"
import { GetProjectOptions, MonoworkspaceMember } from "../types"
import { findUp } from "../utils"

export async function getNxProjects(
  options: GetProjectOptions
): Promise<{ root: string; projects: MonoworkspaceMember[] } | undefined> {
  const nx_root = await findUp("nx.json", options.cwd)
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
