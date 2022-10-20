import { GetProjectOptions } from "../types"
import { Workspace } from "../workspace"

export async function getMultiProjects(options: GetProjectOptions) {
  return await Workspace.getWorkspace(options)
}
