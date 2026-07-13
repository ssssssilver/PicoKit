import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const clientDirectory = fileURLToPath(new URL("../dist/client/", import.meta.url))
const assetsDirectory = join(clientDirectory, "assets")
const serverDirectory = fileURLToPath(new URL("../dist/server/", import.meta.url))

test("every browser Worker referenced by a client chunk is deployed as a client asset", () => {
  const references = new Set()
  for (const file of readdirSync(assetsDirectory).filter((name) => name.endsWith(".js"))) {
    const source = readFileSync(join(assetsDirectory, file), "utf8")
    for (const match of source.matchAll(/\/assets\/([^"'`()]+\.worker-[A-Za-z0-9_-]+\.js)/g)) references.add(match[1])
  }

  assert.ok(references.size >= 4, `expected at least four browser Worker references, found ${references.size}`)
  for (const file of references) {
    assert.equal(existsSync(join(assetsDirectory, file)), true, `missing deployed Worker asset: ${file}`)
  }
})

test("browser WASM stays out of the size-limited Cloudflare Worker bundle", () => {
  const serverFiles = readdirSync(join(serverDirectory, "ssr", "assets"))
  assert.equal(
    serverFiles.some((file) => file.endsWith(".wasm")),
    false,
    "browser WASM must be deployed as a static client asset, not a server module",
  )
})
