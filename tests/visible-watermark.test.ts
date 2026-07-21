import { describe, expect, it } from "vitest"

import {
  clampRect,
  findBestCloneSource,
  geminiDetectionConfidence,
  isConservativeGeminiDetection,
  locateProviderRegion,
  normalizeDragRect,
  visibleMarkAnalysisSize,
} from "@/lib/visible-watermark"

describe("visible watermark geometry", () => {
  it("anchors Doubao and Jimeng profiles inside the bottom-right corner", () => {
    const doubao = locateProviderRegion("doubao", 2048, 2048)
    const jimeng = locateProviderRegion("jimeng", 2048, 2048)

    expect(doubao.x + doubao.width).toBeLessThanOrEqual(2048)
    expect(doubao.y + doubao.height).toBeLessThanOrEqual(2048)
    expect(jimeng.width).toBeGreaterThan(doubao.width)
    expect(jimeng.y).toBeLessThan(doubao.y)
  })

  it("normalizes reverse drags and clamps selections to image bounds", () => {
    expect(normalizeDragRect(80, 70, 20, 10)).toEqual({ x: 20, y: 10, width: 60, height: 60 })
    expect(clampRect({ x: -5, y: 90, width: 200, height: 30 }, 100, 100)).toEqual({ x: 0, y: 90, width: 100, height: 10 })
  })

  it("finds a valid nearby patch for a corner selection", () => {
    const width = 120
    const height = 120
    const data = new Uint8ClampedArray(width * height * 4)
    data.fill(128)
    const source = findBestCloneSource({ width, height, data, colorSpace: "srgb" } as ImageData, { x: 90, y: 95, width: 20, height: 15 })

    expect(source).not.toBeNull()
    expect(source!.x).toBeGreaterThanOrEqual(0)
    expect(source!.y).toBeGreaterThanOrEqual(0)
    expect(source!.x + source!.width).toBeLessThanOrEqual(width)
    expect(source!.y + source!.height).toBeLessThanOrEqual(height)
  })

  it("rejects a selection that leaves no same-sized source patch", () => {
    const width = 40
    const height = 40
    const data = new Uint8ClampedArray(width * height * 4)
    expect(findBestCloneSource({ width, height, data, colorSpace: "srgb" } as ImageData, { x: 0, y: 0, width: 40, height: 40 })).toBeNull()
  })

  it("caps high-resolution visible-mark analysis to a small pixel budget", () => {
    const size = visibleMarkAnalysisSize(8_000, 8_000)
    expect(size).toEqual({ width: 2_000, height: 2_000, scale: 0.25 })
    expect(size.width * size.height).toBeLessThanOrEqual(4_000_000)

    const wide = visibleMarkAnalysisSize(12_000, 3_000)
    expect(Math.max(wide.width, wide.height)).toBeLessThanOrEqual(2_048)
    expect(wide.width * wide.height).toBeLessThanOrEqual(4_000_000)
  })

  it("rejects the weak 82% Gemini heuristic that mislabeled ordinary geometry", () => {
    expect(isConservativeGeminiDetection({
      applied: true,
      position: { x: 800, y: 500, width: 96, height: 96 },
      detection: {
        adaptiveConfidence: 0.82,
        originalSpatialScore: 0.4,
        originalGradientScore: 0.2,
        processedSpatialScore: 0.12,
        suppressionGain: 0.34,
      },
    }, 960, 640)).toBe(false)
  })

  it("only accepts a strong, suppressed bottom-right Gemini match", () => {
    const strong = {
      applied: true,
      position: { x: 840, y: 520, width: 96, height: 96 },
      detection: {
        adaptiveConfidence: 0.94,
        originalSpatialScore: 0.42,
        originalGradientScore: 0.22,
        processedSpatialScore: 0.09,
        suppressionGain: 0.36,
      },
    }
    expect(isConservativeGeminiDetection(strong, 960, 640)).toBe(true)
    expect(isConservativeGeminiDetection({
      ...strong,
      position: { x: 20, y: 20, width: 96, height: 96 },
    }, 960, 640)).toBe(false)
  })

  it("accepts real SDK-validated Gemini marks when adaptive confidence is absent", () => {
    const validated = {
      applied: true,
      source: "standard",
      decisionTier: "validated-match",
      position: { x: 1632, y: 544, width: 48, height: 48 },
      detection: {
        adaptiveConfidence: null,
        originalSpatialScore: 0.9999249808928564,
        originalGradientScore: 0.9998702335504376,
        processedSpatialScore: -0.569984680750134,
        suppressionGain: 1.5699096616429904,
      },
    }

    expect(isConservativeGeminiDetection(validated, 1712, 624)).toBe(true)
    expect(geminiDetectionConfidence(validated)).toBe(0.99)
  })

  it("accepts a validated Gemini mark even when removal-quality metrics are weak", () => {
    const validated = {
      applied: true,
      source: "standard+located-aggressive",
      decisionTier: "validated-match",
      position: { x: 1040, y: 736, width: 96, height: 96 },
      detection: {
        adaptiveConfidence: null,
        originalSpatialScore: 0.2701383796248219,
        originalGradientScore: -0.0017227729472738633,
        processedSpatialScore: -0.0022586512273915626,
        suppressionGain: 0.27239703085221345,
      },
    }

    expect(isConservativeGeminiDetection(validated, 1200, 896)).toBe(true)
    expect(geminiDetectionConfidence(validated)).toBe(0.94)
    expect(isConservativeGeminiDetection({
      ...validated,
      position: { x: 120, y: 120, width: 96, height: 96 },
    }, 1200, 896)).toBe(false)
  })
})
