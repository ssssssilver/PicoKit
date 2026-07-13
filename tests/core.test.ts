import { describe, expect, it } from "vitest"

import { detectImageType } from "@/lib/file-validation"
import { outputSize, searchTargetSize, sourceCrop } from "@/lib/image-transformer"
import { aiScore, normalizeOutput, splitText } from "@/lib/text-detector-core"

describe("image file validation", () => {
  it("detects supported formats from magic bytes instead of the filename", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg")
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png")
    expect(detectImageType(new TextEncoder().encode("RIFF0000WEBP"))?.mime).toBe("image/webp")
    expect(detectImageType(new TextEncoder().encode("<script>"))).toBeNull()
  })
})

describe("text detector core", () => {
  it("keeps chunks within the model window and caps the total", () => {
    const chunks = splitText(Array.from({ length: 40 }, (_, index) => `Paragraph ${index} ${"x".repeat(1700)}`).join("\n\n"))
    expect(chunks).toHaveLength(24)
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(1800)
  })

  it("normalizes single results and resolves AI/human labels", () => {
    const normalized = normalizeOutput([{ label: "Human", score: 0.8 }, { label: "AI", score: 0.2 }], 1)
    expect(normalized).toHaveLength(1)
    expect(aiScore(normalized[0])).toBeCloseTo(0.2)
    expect(aiScore([{ label: "Real", score: 0.3 }])).toBeCloseTo(0.7)
  })
})

describe("image transform geometry", () => {
  it("applies aspect ratio, maximum edge and safety scale", () => {
    expect(outputSize(4000, 3000, { format: "image/jpeg", quality: 0.8, aspect: "1:1", maxEdge: 1200 })).toEqual({ width: 1200, height: 1200 })
    expect(outputSize(4000, 3000, { format: "image/jpeg", quality: 0.8, width: 1000, aspect: "4:3" }, 0.84)).toEqual({ width: 840, height: 630 })
  })

  it("computes a centered crop", () => {
    expect(sourceCrop(4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 })
    expect(sourceCrop(2000, 3000, 16 / 9)).toEqual({ sx: 0, sy: 938, sw: 2000, sh: 1125 })
  })

  it("searches quality and then scales down to approach a target size", async () => {
    const result = await searchTargetSize(async (scale, quality) => ({
      blob: new Blob([new Uint8Array(Math.round(2_000 * quality * scale * scale))]),
      width: Math.round(1000 * scale),
      height: Math.round(800 * scale),
    }), 900, 0.9)
    expect(result.targetReached).toBe(true)
    expect(result.blob.size).toBeLessThanOrEqual(900)
    expect(result.blob.size).toBeGreaterThan(850)
  })
})
