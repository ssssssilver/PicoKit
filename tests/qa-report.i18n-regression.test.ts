import { describe, expect, it } from "vitest"

import { matchesLocalizedQuery } from "@/lib/localized-search"
import { languageOptions } from "@/lib/i18n"
import { loadTranslations, needsTranslation } from "@/lib/locales"
import { toolGuides } from "@/lib/tool-guides"

const translatedLanguages = languageOptions
  .map((item) => item.code)
  .filter(needsTranslation)

const searchTerms = {
  ja: "単位",
  ko: "단위",
  es: "unidad",
  pt: "unidade",
  id: "satuan",
  de: "Einheit",
  pl: "jednost",
  ru: "единиц",
  fr: "unité",
  ar: "وحدة",
  tr: "birim",
} as const

const terminology = {
  ja: { Mass: "質量", From: "変換元", To: "変換先", Guides: "使い方ガイド" },
  ko: { Mass: "질량", From: "변환 전", To: "변환 후", Guides: "사용 안내" },
  es: { Mass: "Masa", From: "De", To: "A", Guides: "Guías" },
  pt: { Mass: "Massa", From: "De", To: "Para", Guides: "Guias" },
  id: { Mass: "Massa", From: "Dari", To: "Ke", Guides: "Panduan" },
  de: { Mass: "Masse", From: "Von", To: "Nach", Guides: "Anleitungen" },
  pl: { Mass: "Masa", From: "Z", To: "Na", Guides: "Poradniki" },
  ru: { Mass: "Масса", From: "Из", To: "В", Guides: "Руководства" },
  fr: { Mass: "Masse", From: "De", To: "Vers", Guides: "Guides" },
  ar: { Mass: "الكتلة", From: "من", To: "إلى", Guides: "الأدلة" },
  tr: { Mass: "Kütle", From: "Kaynak", To: "Hedef", Guides: "Rehberler" },
} as const

function guideEnglishKeys() {
  const values = new Set<string>()
  for (const guide of toolGuides) {
    values.add(guide.titleEn)
    values.add(guide.descriptionEn)
    values.add(guide.categoryTitleEn)
    for (const item of guide.prerequisites) values.add(item.en)
    for (const item of guide.steps) {
      values.add(item.titleEn)
      values.add(item.en)
    }
    for (const item of guide.verification) values.add(item.en)
    for (const item of guide.troubleshooting) values.add(item.en)
  }
  return [...values]
}

// QA regression coverage for qa-report-i18n-picokit-modone0622-workers-dev-2026-07-15.md.
describe("multilingual QA regressions", () => {
  it("indexes the active locale in home and guide searches", async () => {
    const values = [
      { zh: "单位与宽高比", en: "Unit & Aspect-ratio Tools" },
      {
        zh: "转换常用单位，并计算图片比例与等比尺寸。",
        en: "Convert common units and calculate image ratios and proportional sizes.",
      },
    ]

    for (const language of translatedLanguages) {
      const messages = await loadTranslations(language)
      expect(
        matchesLocalizedQuery(
          searchTerms[language],
          values,
          (_zh, en) => messages[en] ?? en,
        ),
        `${language} search should match ${searchTerms[language]}`,
      ).toBe(true)
    }
  })

  it("contains translations for every generated tool-guide field", async () => {
    const requiredKeys = [
      ...guideEnglishKeys(),
      "Guides",
      "Tool guide",
      "Read guide",
      "How to use {name}",
      "Open {name}",
    ]

    for (const language of translatedLanguages) {
      const messages = await loadTranslations(language)
      const missing = requiredKeys.filter((key) => !messages[key]?.trim())
      expect(missing, `${language} is missing guide translations`).toEqual([])
    }
  })

  it("uses reviewed terminology in every supported translation", async () => {
    for (const language of translatedLanguages) {
      const messages = await loadTranslations(language)
      expect(
        {
          Mass: messages.Mass,
          From: messages.From,
          To: messages.To,
          Guides: messages.Guides,
        },
        `${language} terminology`,
      ).toEqual(terminology[language])
    }
  })

  it("keeps reviewed Russian, Polish, Arabic, and Spanish copy", async () => {
    const [ru, pl, ar, es] = await Promise.all([
      loadTranslations("ru"),
      loadTranslations("pl"),
      loadTranslations("ar"),
      loadTranslations("es"),
    ])

    expect(JSON.stringify(ru)).not.toContain("Регистрация запрещена")
    expect(pl["Unit Converter and Aspect-ratio Calculator"]).toContain("proporcji obrazu")
    expect(ar["Unit Converter and Aspect-ratio Calculator"]).toContain("نسبة العرض إلى الارتفاع")
    expect(es["Work with GIFs, audio, video frames, and local screen recordings"]).toMatch(/^Trabaja/)
  })
})
