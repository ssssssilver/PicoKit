import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const readLocale = (locale: string) => JSON.parse(
  readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url), "utf8"),
) as Record<string, string>

const headerSource = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8")

describe("localized desktop header regression", () => {
  it("keeps the auxiliary brand badge out of the constrained desktop navigation row", () => {
    expect(headerSource).toContain("sm:inline xl:hidden")
    expect(headerSource).toContain("on-device")
  })

  it("uses concise localized labels for the longest desktop navigation languages", () => {
    for (const locale of ["es", "pt", "id", "pl", "ru", "fr", "tr"]) {
      const messages = readLocale(locale)
      expect(messages["AI image check"].length).toBeLessThanOrEqual(26)
      expect(messages["Batch image optimizer"].length).toBeLessThanOrEqual(27)
      expect(messages["Batch image optimizer"]).not.toBe("Batch image optimizer")
    }
  })
})
