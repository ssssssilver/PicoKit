import { describe, expect, it } from "vitest"

import { aiDirectoryCategories, aiDirectoryReviewedAt, aiDirectoryTools } from "@/lib/ai-directory"

describe("AI tools directory", () => {
  it("keeps broad task coverage with a dedicated Chinese agent collection", () => {
    expect(aiDirectoryCategories).toHaveLength(9)
    expect(aiDirectoryTools).toHaveLength(71)

    for (const category of aiDirectoryCategories) {
      expect(aiDirectoryTools.filter((tool) => tool.category === category.id).length).toBeGreaterThanOrEqual(7)
    }
    expect(aiDirectoryTools.filter((tool) => tool.category === "china-agents")).toHaveLength(7)
    expect(aiDirectoryTools.filter((tool) => tool.category === "video")).toHaveLength(9)
  })

  it("uses unique official https links without affiliate parameters", () => {
    const slugs = new Set(aiDirectoryTools.map((tool) => tool.slug))
    const urls = new Set(aiDirectoryTools.map((tool) => tool.url))
    expect(slugs.size).toBe(aiDirectoryTools.length)
    expect(urls.size).toBe(aiDirectoryTools.length)

    for (const tool of aiDirectoryTools) {
      const url = new URL(tool.url)
      expect(url.protocol).toBe("https:")
      expect(url.search).toBe("")
      expect(url.hostname).not.toContain("ai-kit.cn")
      expect(url.hostname).not.toContain("producthunt.com")
    }
    expect(aiDirectoryTools.some((tool) => tool.slug === "sora")).toBe(false)
    expect(aiDirectoryTools.some((tool) => tool.slug === "luma-dream-machine")).toBe(true)
    for (const slug of ["kimi-k3", "glm", "deepseek", "doubao", "qwen-studio", "tencent-yuanbao", "minimax-agent", "seedance-2"]) {
      expect(aiDirectoryTools.some((tool) => tool.slug === slug)).toBe(true)
    }
  })

  it("includes bilingual descriptions and enough adoption signals", () => {
    for (const tool of aiDirectoryTools) {
      expect(tool.description.length).toBeGreaterThan(35)
      expect(tool.descriptionZh.length).toBeGreaterThan(12)
      expect(tool.tags.length).toBeGreaterThanOrEqual(3)
    }
    expect(aiDirectoryTools.filter((tool) => tool.featured).length).toBeGreaterThanOrEqual(8)
    expect(aiDirectoryTools.filter((tool) => tool.trending).length).toBeGreaterThanOrEqual(8)
    expect(aiDirectoryReviewedAt).toBe("2026-07-23")
  })
})
