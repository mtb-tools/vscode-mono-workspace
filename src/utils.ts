import { PathLike, constants as fsConstants } from "node:fs"
import { access } from "node:fs/promises"
import path from "node:path"
import { OutputChannel } from "vscode"

export async function checkFileExists(file: PathLike) {
  try {
    await access(file, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function findUp(
  name: string,
  cwd = process.cwd()
): Promise<string | undefined> {
  let up = path.resolve(cwd)
  do {
    cwd = up
    const p = path.resolve(cwd, name)
    if (await checkFileExists(p)) return cwd
    up = path.resolve(cwd, "../")
  } while (up !== cwd)
}

export function logUtils(output_channel: OutputChannel) {
  const log_error = (msg: string, title?: string) => {
    output_channel.appendLine(`error: ${title || ""}${msg}`)
  }

  const log_hint = (msg: string, title?: string) => {
    output_channel.appendLine(`hint: ${title || ""}${msg}`)
  }

  const log = (msg: string, title?: string) => {
    output_channel.appendLine(`info: ${title || ""}${msg}`)
  }
  return {
    log_error,
    log_hint,
    log,
  }
}
