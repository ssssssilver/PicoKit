import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const clientAssets = join(root, "dist", "client", "assets")
const serverRoot = join(root, "dist", "server")

function collectBrowserAssets(directory) {
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectBrowserAssets(path)
    return entry.name.endsWith(".wasm") || /\.worker-[A-Za-z0-9_-]+\.js$/.test(entry.name) ? [path] : []
  })
}

mkdirSync(clientAssets, { recursive: true })

for (const source of collectBrowserAssets(serverRoot)) {
  const target = join(clientAssets, basename(source))
  if (!existsSync(target)) cpSync(source, target)
  rmSync(source)
}
