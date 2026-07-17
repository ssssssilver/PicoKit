import { describe, expect, it } from "vitest"

import { homeHeroSlides } from "@/components/home-hero-banner"
import { allTools, commonToolHrefs, commonTools } from "@/lib/site"

describe("tool navigation priority", () => {
  it("keeps a compact, valid, and intentionally ordered common-tool set", () => {
    expect(commonTools).toHaveLength(8)
    expect(new Set(commonToolHrefs).size).toBe(commonToolHrefs.length)
    expect(commonTools.map((tool) => tool.href)).toEqual([...commonToolHrefs])
    expect(commonToolHrefs.every((href) => allTools.some((tool) => tool.href === href))).toBe(true)
  })

  it("leaves non-common tools available through the expanded directory", () => {
    const commonHrefs = new Set(commonToolHrefs)
    expect(allTools.filter((tool) => !commonHrefs.has(tool.href as typeof commonToolHrefs[number]))).toHaveLength(24)
  })

  it("keeps the rotating homepage banner complete and navigable", () => {
    expect(homeHeroSlides).toHaveLength(4)
    expect(new Set(homeHeroSlides.map((slide) => slide.id)).size).toBe(homeHeroSlides.length)
    expect(homeHeroSlides.every((slide) => slide.href.startsWith("/") && slide.title.zh && slide.title.en)).toBe(true)
    expect(homeHeroSlides[0]).toMatchObject({ id: "toolbox", href: "/remove-background" })
    expect(homeHeroSlides[0].description.zh).toContain("批量去背景")
    expect(homeHeroSlides[0].description.zh).toContain("快速修图")
    expect(homeHeroSlides[0].description.zh).toContain("队列在步骤间保留")
  })
})
