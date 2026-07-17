import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("date and time tool accessibility copy", () => {
  it("formats copy-button labels through the active language", () => {
    const source = readFileSync("components/date-time-tool.tsx", "utf8")
    expect(source).toContain('format("复制 {label}", "Copy {label}", { label })')
    expect(source).not.toContain('aria-label={`Copy ${label}`}')
  })

  it("provides the formatted copy label in every translated locale", () => {
    for (const locale of ["ar", "de", "es", "fr", "id", "ja", "ko", "pl", "pt", "ru", "tr"]) {
      const messages = JSON.parse(readFileSync(resolve("lib/locales", `${locale}.json`), "utf8")) as Record<string, string>
      expect(messages["Copy {label}"], locale).toContain("{label}")
    }
  })
})
