import { workspace as vscodeWorkspace } from "vscode"

interface ProviderOptions {
  core: boolean
  cargo: boolean
  nx: boolean
}
interface ExtensionOptions {
  includeRoot: boolean
  providers_suffix: boolean
  fetch_descriptions: boolean
  providers: ProviderOptions
  folders: FolderOptions
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

export function getSetting<T>(key: string): T {
  const config = vscodeWorkspace.getConfiguration("monorepoWorkspace")
  return config.get<T>(key)
}
