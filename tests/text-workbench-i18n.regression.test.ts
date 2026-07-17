import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("text workbench localization", () => {
  it("formats reading time through the active language", () => {
    const source = readFileSync("components/text-workbench.tsx", "utf8")
    expect(source).toContain('format("{count} 分钟", "{count} min", { count: stats.minutes })')
    expect(source).not.toContain('`${stats.minutes} min`')
  })

  it("provides a reading-time unit in every translated locale", () => {
    for (const locale of ["ar", "de", "es", "fr", "id", "ja", "ko", "pl", "pt", "ru", "tr"]) {
      const messages = JSON.parse(readFileSync(resolve("lib/locales", `${locale}.json`), "utf8")) as Record<string, string>
      expect(messages["{count} min"], locale).toContain("{count}")
    }
  })
})
