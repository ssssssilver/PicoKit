import { describe, expect, it } from "vitest"

import { allTools, toolCategories } from "@/lib/site"
import { getToolGuide, toolGuides } from "@/lib/tool-guides"

describe("tool guide catalog", () => {
  it("covers every first-party tool exactly once", () => {
    expect(toolGuides).toHaveLength(allTools.length)
    expect(toolGuides).toHaveLength(34)
    expect(new Set(toolGuides.map((guide) => guide.slug)).size).toBe(toolGuides.length)
    expect(new Set(toolGuides.map((guide) => guide.href))).toEqual(new Set(allTools.map((tool) => tool.href)))
  })

  it("contains complete bilingual how-to content", () => {
    for (const guide of toolGuides) {
      expect(guide.title.length).toBeGreaterThan(1)
      expect(guide.titleEn.length).toBeGreaterThan(1)
      expect(guide.prerequisites.length).toBeGreaterThanOrEqual(2)
      expect(guide.steps.length).toBeGreaterThanOrEqual(5)
      expect(guide.verification.length).toBeGreaterThanOrEqual(2)
      expect(guide.troubleshooting.length).toBeGreaterThanOrEqual(3)
      expect(guide.readMinutes).toBeGreaterThanOrEqual(5)
      for (const item of [...guide.prerequisites, ...guide.steps, ...guide.verification, ...guide.troubleshooting]) {
        expect(item.zh.trim().length).toBeGreaterThan(8)
        expect(item.en.trim().length).toBeGreaterThan(8)
      }
    }
  })

  it("covers every tool category and resolves slugs", () => {
    expect(new Set(toolGuides.map((guide) => guide.category))).toEqual(new Set(toolCategories.map((category) => category.id)))
    for (const guide of toolGuides) expect(getToolGuide(guide.slug)?.href).toBe(guide.href)
    expect(getToolGuide("missing-guide")).toBeUndefined()
  })
})
