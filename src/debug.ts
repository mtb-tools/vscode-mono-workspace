import { window, workspace as vscodeWorkspace } from "vscode"
import { log_hint } from "./extension"
import json from "json5"
import { findFiles } from "./utils"
/**
 * Simple tool to test workspace.findFiles
 */
export const resolve_util = async () => {
  const pattern = await window.showInputBox({
    title: "Debug Utils",
    prompt: "Specify the pattern to resolve",
  })
  if (pattern) {
    const resolved = await findFiles(pattern)

    log_hint(
      `DEBUG UTILS:\nresolved:${json.stringify(resolved.map((e) => e.fsPath))}`
    )
  }
}
