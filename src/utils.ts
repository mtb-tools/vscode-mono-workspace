import path from "path"
import { OutputChannel, Uri, workspace } from "vscode"

export async function checkFileExists(file: Uri | string) {
  if (typeof file === "string") {
    file = Uri.file(file)
  }
  try {
    await workspace.fs.stat(file)
    //await access(file, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}
const DEFAULT_IGNORE = "**/{node_modules,test,tests,build,target,.git}/**"
export async function findFiles(pattern: string, ignore = DEFAULT_IGNORE) {
  return await workspace.findFiles(pattern, ignore)
}

export async function readFile(file: Uri | string) {
  if (typeof file === "string") {
    file = Uri.file(file)
  }
  const bytes = await workspace.fs.readFile(file)
  return Buffer.from(bytes).toString("utf8")
  //return new TextDecoder('utf-8').decode(bytes);
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
