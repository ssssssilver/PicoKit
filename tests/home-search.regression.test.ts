import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("home tool search", () => {
  it("matches individual tool copy instead of expanding an entire matching category", () => {
    const source = readFileSync(
      new URL("../components/home-tool-directory.tsx", import.meta.url),
      "utf8",
    )
    const filterBlock = source.slice(
      source.indexOf("const tools = useMemo"),
      source.indexOf("const groups = useMemo"),
    )
    expect(filterBlock).toContain("tool.titleEn")
    expect(filterBlock).toContain("tool.descriptionEn")
    expect(filterBlock).not.toContain("categoryDetails")
    expect(filterBlock).not.toContain("categoryDetails.descriptionEn")
  })
})
