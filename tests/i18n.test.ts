import { describe, expect, it } from "vitest"

import {
  appShellDirection,
  detectLanguage,
  directionForLanguage,
  interpolateMessage,
  isLanguage,
  languageOptions,
  localeForLanguage,
  resolveLocalized,
  toggleLanguage,
} from "@/lib/i18n"
import { loadTranslations, needsTranslation } from "@/lib/locales"

describe("i18n helpers", () => {
  it("uses the requested language order", () => {
    expect(languageOptions.map((item) => item.code)).toEqual(["en", "zh-CN", "ja", "ko", "es", "pt", "id", "de", "pl", "ru", "fr", "ar", "tr"])
  })

  it("resolves Chinese, English, and translated values", () => {
    const value = { zh: "本地处理", en: "On-device processing" }
    expect(resolveLocalized(value, "zh-CN")).toBe("本地处理")
    expect(resolveLocalized(value, "en")).toBe("On-device processing")
    expect(resolveLocalized(value, "ja", { "On-device processing": "端末内処理" })).toBe("端末内処理")
    expect(resolveLocalized(value, "ja")).toBe("On-device processing")
  })

  it("detects exact and regional browser languages", () => {
    expect(detectLanguage(["fr-CA", "en-US"])).toBe("fr")
    expect(detectLanguage(["zh-HK", "en-US"])).toBe("zh-CN")
    expect(detectLanguage(["it-IT"])).toBe("en")
  })

  it("accepts all supported identifiers and exposes locale direction", () => {
    for (const option of languageOptions) expect(isLanguage(option.code)).toBe(true)
    expect(isLanguage("it")).toBe(false)
    expect(isLanguage(null)).toBe(false)
    expect(directionForLanguage("ar")).toBe("rtl")
    expect(appShellDirection).toBe("ltr")
    expect(directionForLanguage("de")).toBe("ltr")
    expect(localeForLanguage("ja")).toBe("ja-JP")
  })

  it("interpolates localized message placeholders", () => {
    expect(interpolateMessage("View {count} fields", { count: 12 })).toBe("View 12 fields")
  })

  it("loads complete static translation packs", async () => {
    const translatedLanguages = languageOptions.map((item) => item.code).filter(needsTranslation)
    for (const language of translatedLanguages) {
      const messages = await loadTranslations(language)
      expect(Object.keys(messages).length).toBeGreaterThan(1000)
      expect(messages["My tools"]).toBeTruthy()
      expect(messages["Remove background"]).toBeTruthy()
      expect(messages["My tools"]).not.toBe("My tools")
      expect(JSON.stringify(messages)).not.toMatch(/__\s*PKTERM|PICOKIT_\d+/i)
    }
  })

  it("keeps the legacy two-language toggle stable", () => {
    expect(toggleLanguage("zh-CN")).toBe("en")
    expect(toggleLanguage("en")).toBe("zh-CN")
  })
})
