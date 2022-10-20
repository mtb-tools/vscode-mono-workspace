import type { QuickPickItem, Uri } from "vscode"
import type { PackageJson as PJson } from "type-fest"
export declare type PackageJson = PJson & {
  name: string
  ultra?: {
    concurrent?: string[]
  }
}
export declare type PackageJsonWithRoot = PackageJson & {
  root: string
}

export enum PackageAction {
  newWindow,
  currentWindow,
  workspaceFolder,
}
export declare enum WorkspaceProviderType {
  single = "single",
  lerna = "lerna",
  yarn = "yarn",
  pnpm = "pnpm",
  rush = "rush",
  recursive = "recursive",
}

export type GetProjectOptions = Partial<{
  cwd: Uri
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
  root: Uri
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
declare const defaultOptions: {
  cwd: string
  type: WorkspaceProviderType | undefined
  includeRoot: boolean
}
export declare type WorkspaceOptions = typeof defaultOptions
export declare class Workspace {
  root: string
  type: WorkspaceProviderType
  packages: Map<string, PackageJsonWithRoot>
  roots: Map<string, string>
  order: string[]
  private constructor()
  getPackageManager(): string | undefined
  static detectWorkspaceProviders(
    cwd?: string
  ): Promise<WorkspaceProviderType[]>
  static getWorkspace(
    _options?: Partial<WorkspaceOptions>
  ): Promise<Workspace | undefined>
  getPackageForRoot(root: string): string | undefined
  getDeps(pkgName: string): string[]
  _getDepTree(pkgName: string, seen?: string[]): string[]
  getDepTree(pkgName: string): string[]
  getPackages(filter?: string): PackageJsonWithRoot[]
}
