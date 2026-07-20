import { describe, expect, it } from "vitest"

import {
  buildImageEvidenceReport,
  buildReadableImageEvidenceReport,
  type DetectionChannelAvailability,
} from "@/components/image-inspector-tool"
import {
  aggregateImageViews,
  buildImageViewPlan,
  fuseImageDetection,
  pixelEstimateBand,
  type PixelDetectionResult,
} from "@/lib/image-detector-core"
import type { ImageInspection } from "@/lib/image-types"

// Regression: square images were counted twice and regional outliers could
// dominate a precise-looking AI score. Added during the detector quality pass.

const channels: DetectionChannelAvailability = {
  provenance: "available",
  visibleMark: "available",
  pixel: "available",
}

const inspection: ImageInspection = {
  fileName: "sample.webp",
  mime: "image/webp",
  format: "WebP",
  bytes: 4096,
  width: 1200,
  height: 800,
  metadata: [],
  signals: [],
  c2pa: { present: false, validated: null, summary: "none" },
  risk: "unknown",
  note: "",
}

function pixel(
  score: number,
  backend = "webgpu",
  consistency = 1,
  spread = 0,
): PixelDetectionResult {
  return {
    score,
    consistency,
    spread,
    backend,
    model: "test-detector@revision",
    views: [{ view: "full", score }],
    aggregation: "robust-full-region-v2",
    calibration: "conservative-backend-v1",
  }
}

describe("AI image detector quality regressions", () => {
  it("creates unique, in-bounds views for square, landscape, portrait, and small images", () => {
    const cases = [
      [1024, 1024],
      [1200, 800],
      [800, 1200],
      [200, 180],
    ] as const
    for (const [width, height] of cases) {
      const plan = buildImageViewPlan(width, height)
      const keys = plan.map((item) => item.bounds?.join(":") ?? "full")
      expect(new Set(keys).size).toBe(keys.length)
      for (const item of plan) {
        if (!item.bounds) continue
        expect(item.bounds[0]).toBeGreaterThanOrEqual(0)
        expect(item.bounds[1]).toBeGreaterThanOrEqual(0)
        expect(item.bounds[2]).toBeLessThan(width)
        expect(item.bounds[3]).toBeLessThan(height)
      }
    }
    expect(buildImageViewPlan(1024, 1024)).toHaveLength(1)
    expect(buildImageViewPlan(200, 180)).toHaveLength(1)
  })

  it("keeps backend boundaries and regional disagreement conservative", () => {
    expect(pixelEstimateBand(pixel(0.8, "webgpu"))).toBe("higher")
    expect(pixelEstimateBand(pixel(0.8, "wasm"))).toBe("uncertain")
    expect(pixelEstimateBand(pixel(0.12, "wasm"))).toBe("lower")
    expect(pixelEstimateBand(pixel(0.95, "webgpu", 0.4, 0.28))).toBe("uncertain")
  })

  it("uses the regional median so one extreme crop cannot flip the whole image", () => {
    const result = aggregateImageViews([
      [{ label: "real", score: 0.82 }],
      [{ label: "real", score: 0.8 }],
      [{ label: "real", score: 0.84 }],
      [{ label: "fake", score: 0.99 }],
    ], ["full", "center", "top-left", "top-right"], "webgpu", "test-detector")
    expect(result.score).toBeLessThan(0.3)
    expect(pixelEstimateBand(result)).toBe("uncertain")
  })

  it("keeps explicit provenance stronger while reporting a pixel conflict", () => {
    const withProvenance: ImageInspection = {
      ...inspection,
      signals: [{
        id: "generator",
        label: "Generator",
        value: "ComfyUI",
        group: "ai",
        severity: "high",
      }],
    }
    expect(fuseImageDetection(pixel(0.1), withProvenance)).toMatchObject({
      band: "higher-ai-signals",
      evidenceAgreement: "conflict",
      reliability: "low",
    })
  })

  it("exports a calibrated AI likelihood while keeping the evidence limits explicit", () => {
    const result = pixel(0.84)
    const json = buildImageEvidenceReport({
      file: { name: "sample.webp", type: "image/webp", bytes: 4096 },
      inspection,
      pixel: result,
      visibleMark: null,
      channels,
    })
    const zh = buildReadableImageEvidenceReport({
      language: "zh-CN",
      file: null,
      inspection,
      pixel: result,
      visibleMark: null,
      channels,
    })
    const en = buildReadableImageEvidenceReport({
      language: "en",
      file: null,
      inspection,
      pixel: result,
      visibleMark: null,
      channels,
    })
    expect(json.version).toBe("1.4.0")
    expect(json.summary.aiLikelihoodPercent).toBeGreaterThanOrEqual(68)
    expect(json.summary.likelihoodCalibration).toBe("evidence-weighted-likelihood-v1")
    expect(json.channels.pixelStatistics.result?.aggregation).toBe("robust-full-region-v2")
    expect(zh).toContain("检测结果: AI 生成")
    expect(en).toContain("Detection result: AI-generated")
    expect(zh).toContain("AI 可能性:")
    expect(zh).toContain("经保守校准后的估计")
    expect(zh).toContain("较高的 AI 类像素信号")
    expect(en).toContain("AI likelihood:")
    expect(en).toContain("conservatively calibrated estimate")
    expect(en).toContain("Higher AI-like pixel signals")
  })
})
