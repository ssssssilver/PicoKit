export const themeStorageKey = "picokit-theme"

export const themes = ["light", "dark"] as const

export type Theme = (typeof themes)[number]

export const defaultTheme: Theme = "dark"

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme)
}

export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark"
}
