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

/// Settings

interface ProviderOptions {
  core: boolean
  cargo: boolean
  nx: boolean
}
export interface MonoworkspaceMember {
  name: string
  root: string
}
export interface ExtensionOptions {
  includeRoot?: boolean
  providers_suffix?: boolean
  fetch_descriptions?: boolean
  providers?: ProviderOptions
  folders?: FolderOptions
  sets?: { name: string; members: MonoworkspaceMember[] }[]
}

// Emoji used per type
interface PrefixOptions {
  apps: string
  libs: string
  tools: string
  root: string
  unknown: string
}
interface RegexOptions {
  apps: string
  libs: string
  tools: string
}
interface FolderOptions {
  prefix: PrefixOptions
  regex: RegexOptions
  custom?: string[]
}
