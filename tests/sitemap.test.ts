import { describe, expect, it } from "vitest"

import sitemap from "@/app/sitemap"

describe("sitemap canonical routes", () => {
  it("does not advertise compatibility aliases that redirect", () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith("/image-metadata-checker"))).toBe(false)
    expect(urls.some((url) => url.endsWith("/ai-watermark-remover"))).toBe(false)
    expect(urls.some((url) => url.endsWith("/remove-ai-metadata-from-image"))).toBe(true)
    expect(urls.some((url) => url.endsWith("/gemini-watermark-remover"))).toBe(true)
    expect(urls.some((url) => url.endsWith("/one-click-ai-cleaner"))).toBe(true)
  })
})
