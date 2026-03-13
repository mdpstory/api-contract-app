import { existsSync, readFileSync } from "fs"

let loaded = false

export function loadRootEnv(): void {
  if (loaded) return

  const envPath = new URL("../../../../.env", import.meta.url).pathname
  if (!existsSync(envPath)) {
    loaded = true
    return
  }

  const content = readFileSync(envPath, "utf8")

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (!key || process.env[key] !== undefined) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      process.env[key] = value.slice(1, -1)
      continue
    }

    process.env[key] = value
  }

  loaded = true
}
