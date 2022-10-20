// import { readFile } from "node:fs/promises"
import path from "path"
import { log_hint } from "../extension"
import { GetProjectOptions, MonoworkspaceMember } from "../types"
import { checkFileExists, findFiles, findUp, readFile } from "../utils"
import { parse as parseToml } from "toml"
import { Uri, workspace as vscodeWorkspace } from "vscode"
type CargoWorkspace = { workspace: { members: string[] } }

export async function getCargoProjects(
  options: GetProjectOptions
): Promise<MonoworkspaceMember[]> {
  const ws_root = await findUp("Cargo.toml", options.cwd?.fsPath)
  if (!ws_root) throw "Root not found"
  log_hint(ws_root, "Gettings Cargo Packages from:")

  const cargo_root = path.join(ws_root, "Cargo.toml")

  if (!(await checkFileExists(cargo_root))) return []

  const cargo_content = await readFile(cargo_root)
  const content: CargoWorkspace = parseToml(
    cargo_content.toString()
  ) as CargoWorkspace

  const members = content.workspace?.members
  if (!members) return []
  return (
    await Promise.all(
      content.workspace.members.map(async (member) => {
        const abs_member = path.join(member, "Cargo.toml")
        const resolved_members = await findFiles(abs_member)
        log_hint(`Member ${abs_member}`)
        log_hint(
          `Resolved ${JSON.stringify(resolved_members.map((e) => e.fsPath))}`
        )
        // const m_cargo = path.join(ws_root, m_root, "Cargo.toml")
        for (const m of resolved_members) {
          const m_content_raw = await readFile(m)
          const m_content: { package: { name: string } } = parseToml(
            m_content_raw
          ) as { package: { name: string } }

          return {
            name: m_content.package.name,
            root: Uri.file(path.dirname(m.fsPath)),
          }
        }
      })
    )
  ).filter((m) => m !== undefined) as MonoworkspaceMember[]
}
