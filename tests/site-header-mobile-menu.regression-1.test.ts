import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const headerSource = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8")

describe("mobile header menu keyboard regression", () => {
  it("closes every open header menu when Escape is pressed", () => {
    // Regression: ISSUE-001 — the expanded mobile navigation ignored Escape.
    // Found by /qa on 2026-07-17
    // Report: .gstack/qa-reports/qa-report-localhost-2026-07-17.md
    const escapeHandler = headerSource.match(/function closeOnEscape[\s\S]*?window\.addEventListener\("pointerdown"/)?.[0]

    expect(escapeHandler).toContain('event.key === "Escape"')
    expect(escapeHandler).toContain("setOpen(false)")
    expect(escapeHandler).toContain("setLanguageOpen(false)")
  })

  it("keeps the two processing tools starred and AI image detection out of the header", () => {
    for (const href of ["/remove-background", "/pdf-tools"]) {
      const link = headerSource.match(new RegExp(`<Link href="${href}"[\\s\\S]*?</Link>`))?.[0]
      expect(link).toContain("<Star")
    }

    expect(headerSource).not.toContain('href="/ai-image-detector"')
    expect(headerSource).not.toContain('pick("更多", "More")')
    expect(headerSource).not.toContain("HeaderMenuLink")
    expect(headerSource.match(/href="\/ai-tools"[\s\S]*?AI 工具导航/)?.[0]).toContain("text-zinc-300")
  })
})
