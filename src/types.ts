import type { WorkspaceProviderType } from "ultra-runner"
import type { QuickPickItem, Uri } from "vscode"

export enum PackageAction {
  newWindow,
  currentWindow,
  workspaceFolder,
}

export type GetProjectOptions = Partial<{
  cwd: string
  type: WorkspaceProviderType | undefined
  includeRoot: boolean
}>

export interface WorkspaceFolderItem extends QuickPickItem {
  root: Uri
  emoji?: string
  isRoot?: boolean
  description?: string
}
