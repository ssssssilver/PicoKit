import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const readLocale = (locale: string) => JSON.parse(
  readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url), "utf8"),
) as Record<string, string>

const headerSource = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8")

describe("localized desktop header regression", () => {
  it("keeps the auxiliary brand badge out of the constrained desktop navigation row", () => {
    expect(headerSource).toContain("sm:inline md:hidden")
    expect(headerSource).toContain("on-device")
  })

  it("keeps the two flagship tools and the unstarred AI directory visible in the zoomed desktop range", () => {
    expect(headerSource).toContain("md:flex")
    expect(headerSource).toContain("lg:hidden")
    expect(headerSource).toContain("lg:max-w-none")
    expect(headerSource).toContain("truncate")
    expect(headerSource).toContain('xl:inline-flex')
    expect(headerSource.indexOf('href="/remove-background"')).toBeLessThan(
      headerSource.indexOf('href="/pdf-tools"'),
    )
    expect(headerSource.indexOf('href="/pdf-tools"')).toBeLessThan(
      headerSource.indexOf('href="/ai-tools"'),
    )
    expect(headerSource).not.toContain('href="/ai-image-detector"')
    const aiDirectoryLink = headerSource.match(/<Link href="\/ai-tools"[\s\S]*?<\/Link>/)?.[0]
    expect(aiDirectoryLink).toContain("inline-flex")
    expect(aiDirectoryLink).not.toContain("<Star")
    expect(aiDirectoryLink).not.toContain("xl:inline-flex")
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
