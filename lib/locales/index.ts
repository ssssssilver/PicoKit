import type { Language, TranslationMap } from "@/lib/i18n"

type TranslatedLanguage = Exclude<Language, "zh-CN" | "en">

const translationLoaders: Record<TranslatedLanguage, () => Promise<TranslationMap>> = {
  ja: () => import("./ja.json").then((module) => module.default),
  ko: () => import("./ko.json").then((module) => module.default),
  es: () => import("./es.json").then((module) => module.default),
  pt: () => import("./pt.json").then((module) => module.default),
  id: () => import("./id.json").then((module) => module.default),
  de: () => import("./de.json").then((module) => module.default),
  pl: () => import("./pl.json").then((module) => module.default),
  ru: () => import("./ru.json").then((module) => module.default),
  fr: () => import("./fr.json").then((module) => module.default),
  ar: () => import("./ar.json").then((module) => module.default),
  tr: () => import("./tr.json").then((module) => module.default),
}

const translationCache = new Map<TranslatedLanguage, TranslationMap>()

export function needsTranslation(language: Language): language is TranslatedLanguage {
  return language !== "zh-CN" && language !== "en"
}

export async function loadTranslations(language: TranslatedLanguage) {
  const cached = translationCache.get(language)
  if (cached) return cached

  const messages = await translationLoaders[language]()
  translationCache.set(language, messages)
  return messages
}
