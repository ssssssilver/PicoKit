import { describe, expect, it } from "vitest"

import { isLanguage, resolveLocalized, toggleLanguage } from "@/lib/i18n"

describe("i18n helpers", () => {
  it("resolves bilingual values for Chinese and English", () => {
    const value = { zh: "本地处理", en: "On-device processing" }
    expect(resolveLocalized(value, "zh-CN")).toBe("本地处理")
    expect(resolveLocalized(value, "en")).toBe("On-device processing")
  })

  it("keeps language-neutral strings unchanged", () => {
    expect(resolveLocalized("C2PA", "zh-CN")).toBe("C2PA")
    expect(resolveLocalized("C2PA", "en")).toBe("C2PA")
  })

  it("accepts only supported language identifiers", () => {
    expect(isLanguage("zh-CN")).toBe(true)
    expect(isLanguage("en")).toBe(true)
    expect(isLanguage("fr")).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })

  it("toggles between Chinese and English", () => {
    expect(toggleLanguage("zh-CN")).toBe("en")
    expect(toggleLanguage("en")).toBe("zh-CN")
  })
})
