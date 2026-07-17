import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("regex and URL tool localized defaults", () => {
  it("uses a language-neutral URL sample", () => {
    const source = readFileSync("components/regex-url-tool.tsx", "utf8")
    expect(source).toContain("https://example.com/search?q=TabNative tools")
    expect(source).not.toContain("TabNative 工具")
  })
})
