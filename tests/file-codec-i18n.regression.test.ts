import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("file checksum localization", () => {
  it("localizes checksum-row copy actions", () => {
    const source = readFileSync(
      new URL("../components/file-codec-tool.tsx", import.meta.url),
      "utf8",
    )
    expect(source).toContain('pick("复制", "Copy")')
    expect(source).not.toMatch(/>Copy \{warning/)
  })
})
