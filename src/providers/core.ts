import { getWorkspace } from "ultra-runner"
import { GetProjectOptions } from "../types"

export async function getMultiProjects(options: GetProjectOptions) {
  return await getWorkspace(options)
}
