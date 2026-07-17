import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import { defaultTheme, isTheme, toggleTheme } from "@/lib/theme"

describe("theme helpers", () => {
  it("keeps dark mode as the default for returning visual consistency", () => {
    expect(defaultTheme).toBe("dark")
  })

  it("accepts only supported theme identifiers", () => {
    expect(isTheme("light")).toBe(true)
    expect(isTheme("dark")).toBe(true)
    expect(isTheme("system")).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it("toggles between light and dark modes", () => {
    expect(toggleTheme("dark")).toBe("light")
    expect(toggleTheme("light")).toBe("dark")
  })

  it("keeps background-removal preview labels legible in light mode", async () => {
    const css = await readFile("app/globals.css", "utf8")
    expect(css).toContain(".light .workflow-preview-label")
    expect(css).toContain(".light .workflow-preview-action")
    expect(css).toContain("color: #ffffff !important")
    expect(css).toContain("background: #cffafe !important")
  })
})
