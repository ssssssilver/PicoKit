import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { languageOptions } from "@/lib/i18n"
import { loadTranslations, needsTranslation } from "@/lib/locales"

// Regression: ISSUE-002 — the export-size prefix kept its English fallback because the lookup key had a trailing space.
// Found by /qa on 2026-07-15
// Report: .gstack/qa-reports/qa-report-tabnative-modone0622-workers-dev-2026-07-15.md
describe("quick image editor localized export status", () => {
  it("uses the exact translated key and provides it in every locale", async () => {
    const source = readFileSync(new URL("../components/quick-image-editor.tsx", import.meta.url), "utf8")
    expect(source).toContain('pick("结果已下载到本机：", "Downloaded to this device:")')
    expect(source).not.toContain('pick("结果已下载到本机：", "Downloaded to this device: ")')

    for (const language of languageOptions.map((item) => item.code).filter(needsTranslation)) {
      const messages = await loadTranslations(language)
      expect(messages["Downloaded to this device:"], `${language} export status`).toBeTruthy()
    }
  })
})
