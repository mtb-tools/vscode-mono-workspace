import { readFile } from "node:fs/promises"
import path from "node:path"
import { log_hint } from "../extension"
import { GetProjectOptions, MonoworkspaceMember } from "../types"
import { checkFileExists, findUp } from "../utils"
import { parse as parseToml } from "toml"

export async function getCargoProjects(
  options: GetProjectOptions
): Promise<MonoworkspaceMember[]> {
  const ws_root = await findUp("Cargo.toml", options.cwd)
  if (!ws_root) throw "Root not found"
  log_hint(ws_root, "Gettings Cargo Packages from:")

  const cargo_root = path.join(ws_root, "Cargo.toml")

  if (await checkFileExists(cargo_root)) {
    const cargo_content = await readFile(cargo_root)
    const content: { workspace: { members: string[] } } = parseToml(
      cargo_content.toString()
    ) as { workspace: { members: string[] } }

    const members = content.workspace?.members
      ? await Promise.all(
          content.workspace.members.map(async (member) => {
            const m_root = member
            const m_cargo = path.join(ws_root, m_root, "Cargo.toml")

            if (await checkFileExists(m_cargo)) {
              const m_content_raw = await readFile(m_cargo)
              const m_content: { package: { name: string } } = parseToml(
                m_content_raw.toString()
              ) as { package: { name: string } }

              return {
                name: m_content.package.name,
                root: path.join(ws_root, m_root),
              }
            }
          })
        )
      : []
    if (members) {
      return members.filter((m) => m !== undefined) as MonoworkspaceMember[]
    }
  }
  return []
}
