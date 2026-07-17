export const languageOptions = [
  { code: "en", label: "English", shortLabel: "EN", locale: "en-US", dir: "ltr" },
  { code: "zh-CN", label: "中文", shortLabel: "中文", locale: "zh-CN", dir: "ltr" },
  { code: "ja", label: "日本語", shortLabel: "日本語", locale: "ja-JP", dir: "ltr" },
  { code: "ko", label: "한국어", shortLabel: "한국어", locale: "ko-KR", dir: "ltr" },
  { code: "es", label: "Español", shortLabel: "ES", locale: "es-ES", dir: "ltr" },
  { code: "pt", label: "Português", shortLabel: "PT", locale: "pt-PT", dir: "ltr" },
  { code: "id", label: "Bahasa Indonesia", shortLabel: "ID", locale: "id-ID", dir: "ltr" },
  { code: "de", label: "Deutsch", shortLabel: "DE", locale: "de-DE", dir: "ltr" },
  { code: "pl", label: "Polski", shortLabel: "PL", locale: "pl-PL", dir: "ltr" },
  { code: "ru", label: "Русский", shortLabel: "RU", locale: "ru-RU", dir: "ltr" },
  { code: "fr", label: "Français", shortLabel: "FR", locale: "fr-FR", dir: "ltr" },
  { code: "ar", label: "العربية", shortLabel: "العربية", locale: "ar", dir: "rtl" },
  { code: "tr", label: "Türkçe", shortLabel: "TR", locale: "tr-TR", dir: "ltr" },
] as const

export type Language = (typeof languageOptions)[number]["code"]
export type LanguageDirection = (typeof languageOptions)[number]["dir"]
export type TranslationMap = Readonly<Record<string, string>>

// The product shell keeps a stable visual and interaction order. Language text
// direction is exposed separately through directionForLanguage().
export const appShellDirection: LanguageDirection = "ltr"

export type LocalizedValue = string | {
  zh: string
  en: string
}

export const defaultLanguage: Language = "zh-CN"
export const languageStorageKey = "picokit-language"
export const legacyLanguageStorageKey = "localproof-language"

const languageCodes = new Set<string>(languageOptions.map((item) => item.code))

export function resolveLocalized(value: LocalizedValue, language: Language, translations?: TranslationMap) {
  if (typeof value === "string") return value
  if (language === "zh-CN") return value.zh
  if (language === "en") return value.en
  return translations?.[value.en] ?? value.en
}

export function translateEnglish(value: string, language: Language, translations?: TranslationMap) {
  if (language === "zh-CN" || language === "en") return value
  return translations?.[value] ?? value
}

export function interpolateMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-zA-Z][\w-]*)\}/g, (match, key: string) => key in values ? String(values[key]) : match)
}

export function isLanguage(value: string | null): value is Language {
  return Boolean(value && languageCodes.has(value))
}

export function detectLanguage(preferredLanguages: readonly string[]): Language {
  for (const preferred of preferredLanguages) {
    const normalized = preferred.toLowerCase()
    const exact = languageOptions.find((item) => item.code.toLowerCase() === normalized)
    if (exact) return exact.code
    const base = normalized.split("-")[0]
    const match = languageOptions.find((item) => item.code.toLowerCase().split("-")[0] === base)
    if (match) return match.code
  }
  return "en"
}

export function getLanguageOption(language: Language) {
  return languageOptions.find((item) => item.code === language)!
}

export function localeForLanguage(language: Language) {
  return getLanguageOption(language).locale
}

export function directionForLanguage(language: Language): LanguageDirection {
  return getLanguageOption(language).dir
}

/** Kept for old integrations; the header now exposes the full language list. */
export function toggleLanguage(language: Language): Language {
  return language === "zh-CN" ? "en" : "zh-CN"
}
