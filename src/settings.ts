import path from "node:path"
import { workspace as vscodeWorkspace } from "vscode"

export function getSetting<T>(key: string): T | undefined {
  const config = vscodeWorkspace.getConfiguration("monoWorkspace")
  return config.get<T>(key)
}

export function getFolderEmoji(root: string, pkgRoot: string) {
  // const configg = vscodeWorkspace.getConfiguration()
  // const icon_theme = configg.workbench.iconTheme

  // output_channel.appendLine(
  //   JSON.stringify(
  //     extensions.getExtension("Equinusocio.vsc-community-material-theme")
  //   )
  // )
  // const t = ThemeIcon.File
  //

  if (root == pkgRoot) return getSetting<string>("folders.prefix.root") || ""
  //config.get<string>("prefix.root") || ""
  const dir = path.relative(root, pkgRoot)

  // Use custom prefixes first
  const custom = getSetting<{ regex: string; prefix: string }[]>(
    "folders.custom"
  )
  if (custom?.length) {
    for (const c of custom) {
      if (c.prefix && c.regex && new RegExp(c.regex, "u").test(dir))
        return c.prefix
    }
  }

  for (const type of ["apps", "libs", "tools"]) {
    const regex = getSetting<string>(`folders.regex.${type}`)
    const prefix = getSetting<string>(`folders.prefix.${type}`)
    if (regex && prefix && new RegExp(regex, "u").test(dir)) return prefix
  }
  return getSetting<string>("folders.prefix.unknown") || ""
}
