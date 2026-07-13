import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "..")

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(relative) : /\.(ts|tsx)$/.test(entry.name) ? [relative] : []
  }))
  return nested.flat()
}

describe("local-processing privacy boundary", () => {
  it("contains no client upload implementation", async () => {
    const files = (await Promise.all(["app", "components", "lib", "workers"].map(sourceFiles))).flat()
    const sources = await Promise.all(files.map(async (file) => ({ file, source: await readFile(path.join(root, file), "utf8") })))
    const forbidden = /\b(FormData|XMLHttpRequest|sendBeacon|axios)\b|fetch\s*\(/i
    const violations = sources.filter(({ source }) => forbidden.test(source)).map(({ file }) => file)
    expect(violations).toEqual([])
  })
})
