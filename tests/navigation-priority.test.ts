import { describe, expect, it } from "vitest"

import { heroRotationMs, homeHeroSlides, nextHeroSlideIndex } from "@/components/home-hero-banner"
import { allTools, commonToolHrefs, commonTools } from "@/lib/site"

describe("tool navigation priority", () => {
  it("keeps a compact, valid, and intentionally ordered common-tool set", () => {
    expect(commonTools).toHaveLength(9)
    expect(new Set(commonToolHrefs).size).toBe(commonToolHrefs.length)
    expect(commonTools.map((tool) => tool.href)).toEqual([...commonToolHrefs])
    expect(commonToolHrefs.every((href) => allTools.some((tool) => tool.href === href))).toBe(true)
    expect(commonToolHrefs).toContain("/image-wobble-maker")
  })

  it("leaves non-common tools available through the expanded directory", () => {
    const commonHrefs = new Set(commonToolHrefs)
    expect(allTools.filter((tool) => !commonHrefs.has(tool.href as typeof commonToolHrefs[number]))).toHaveLength(25)
  })

  it("keeps the rotating homepage banner complete and navigable", () => {
    expect(homeHeroSlides).toHaveLength(3)
    expect(new Set(homeHeroSlides.map((slide) => slide.id)).size).toBe(homeHeroSlides.length)
    expect(homeHeroSlides.every((slide) => slide.href.startsWith("/") && slide.title.zh && slide.title.en)).toBe(true)
    expect(homeHeroSlides[0]).toMatchObject({ id: "image-delivery", href: "/remove-background" })
    expect(homeHeroSlides[0].eyebrow).toMatchObject({ zh: expect.stringContaining("批量图片处理"), en: "Batch Image Processing" })
    expect(homeHeroSlides[1]).toMatchObject({ id: "documents", href: "/pdf-tools" })
    expect(homeHeroSlides[1].eyebrow).toMatchObject({ zh: expect.stringContaining("PDF 批量处理"), en: "Batch PDF Processing" })
    expect(homeHeroSlides[2]).toMatchObject({ id: "inspection", href: "/ai-image-detector" })
    expect(homeHeroSlides.map((slide) => slide.imageSrc)).toEqual([
      "/illustrations/hero-image-workspace.webp",
      "/illustrations/hero-pdf-workspace.webp",
      "/illustrations/hero-ai-image-detection.webp",
    ])
    expect(homeHeroSlides.some((slide) => slide.href === "/image-compressor")).toBe(false)
    expect(homeHeroSlides[0].description.zh).toContain("批量去背景")
    expect(homeHeroSlides[0].description.zh).toContain("快速修图")
    expect(homeHeroSlides[0].description.zh).toContain("队列在步骤间保留")
    expect(heroRotationMs).toBeGreaterThanOrEqual(5_000)
    expect(nextHeroSlideIndex(0, -1)).toBe(homeHeroSlides.length - 1)
    expect(nextHeroSlideIndex(homeHeroSlides.length - 1, 1)).toBe(0)
  })
})
