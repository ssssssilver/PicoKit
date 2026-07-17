"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { defaultTheme, isTheme, themeStorageKey, type Theme } from "@/lib/theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? defaultTheme)

  const applyTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    const root = document.documentElement
    root.classList.toggle("dark", nextTheme === "dark")
    root.classList.toggle("light", nextTheme === "light")
    root.dataset.theme = nextTheme
    root.style.colorScheme = nextTheme
    window.localStorage.setItem(themeStorageKey, nextTheme)
    document.cookie = `${themeStorageKey}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(themeStorageKey)
    if (isTheme(stored) && stored !== theme) {
      const timer = window.setTimeout(() => applyTheme(stored), 0)
      return () => window.clearTimeout(timer)
    }
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.classList.toggle("light", theme === "light")
    root.dataset.theme = theme
    root.style.colorScheme = theme
  }, [applyTheme, theme])

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme: applyTheme }), [applyTheme, theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside ThemeProvider")
  return context
}
