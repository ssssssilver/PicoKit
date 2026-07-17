import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("random picker localization", () => {
  it("formats group numbers through the active language", () => {
    const source = readFileSync("components/random-picker-tool.tsx", "utf8")
    expect(source.match(/format\("第 \{number\} 组", "Group \{number\}"/g)).toHaveLength(3)
    expect(source).not.toContain('pick("第", "Group ")')
  })

  it("provides a numbered-group pattern in every translated locale", () => {
    for (const locale of ["ar", "de", "es", "fr", "id", "ja", "ko", "pl", "pt", "ru", "tr"]) {
      const messages = JSON.parse(readFileSync(resolve("lib/locales", `${locale}.json`), "utf8")) as Record<string, string>
      expect(messages["Group {number}"], locale).toContain("{number}")
    }
  })
})
