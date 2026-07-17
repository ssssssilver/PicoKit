import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")
const languageProviderSource = readFileSync(new URL("../components/language-provider.tsx", import.meta.url), "utf8")

describe("RTL application shell regression", () => {
  it("keeps the application shell LTR while exposing the selected text direction", () => {
    expect(layoutSource).toMatch(/dir=\{appShellDirection\}/)
    expect(layoutSource).not.toMatch(/dir=\{directionForLanguage/)
    expect(languageProviderSource).toMatch(/document\.documentElement\.dir = appShellDirection/)
    expect(languageProviderSource).not.toMatch(/document\.documentElement\.dir = directionForLanguage/)
    expect(languageProviderSource).toMatch(/dataset\.textDirection = directionForLanguage\(language\)/)
  })
})
