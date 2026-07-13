export type Language = "zh-CN" | "en"

export type LocalizedValue = string | {
  zh: string
  en: string
}

export const defaultLanguage: Language = "zh-CN"
export const languageStorageKey = "picokit-language"
export const legacyLanguageStorageKey = "localproof-language"

export function resolveLocalized(value: LocalizedValue, language: Language) {
  if (typeof value === "string") return value
  return language === "en" ? value.en : value.zh
}

export function isLanguage(value: string | null): value is Language {
  return value === "zh-CN" || value === "en"
}

export function toggleLanguage(language: Language): Language {
  return language === "zh-CN" ? "en" : "zh-CN"
}
