import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  buildImageEvidenceReport,
  getSimpleImageVerdict,
  IMAGE_EVIDENCE_REPORT_VERSION,
  IMAGE_INSPECTOR_MAX_PIXELS,
  summarizeImageEvidence,
  type DetectionChannelAvailability,
} from "@/components/image-inspector-tool"
import {
  IMAGE_PIXEL_DETECTOR_VERSION,
  IMAGE_PIXEL_MODEL_ID,
  IMAGE_PIXEL_MODEL_REVISION,
  IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
  IMAGE_PIXEL_SECONDARY_MODEL_ID,
  IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
  type PixelDetectionResult,
} from "@/lib/image-detector-core"
import type { ImageInspection } from "@/lib/image-types"

const source = readFileSync(
  new URL("../components/image-inspector-tool.tsx", import.meta.url),
  "utf8",
)

const emptyInspection: ImageInspection = {
  fileName: "sample.png",
  mime: "image/png",
  format: "PNG",
  bytes: 1200,
  sha256: "a".repeat(64),
  inspectedAt: "2026-07-15T00:00:01.000Z",
  width: 640,
  height: 480,
  metadata: [],
  signals: [],
  c2pa: { present: false, validated: null, summary: "none" },
  risk: "unknown",
  note: "",
}

const pixel: PixelDetectionResult = {
  score: 0.79,
  consistency: 0.72,
  spread: 0.08,
  backend: "wasm",
  model: "test-image-detector-v1",
  views: [{ view: "full", score: 0.79 }],
}

const allAvailable: DetectionChannelAvailability = {
  provenance: "available",
  visibleMark: "available",
  pixel: "available",
}

describe("image source-evidence report", () => {
  it("prioritizes deterministic file evidence over visual clues and statistics", () => {
    const inspection: ImageInspection = {
      ...emptyInspection,
      signals: [
        {
          id: "ai-0",
          label: "AI workflow",
          value: "ComfyUI",
          group: "ai",
          severity: "high",
        },
      ],
    }

    expect(
      summarizeImageEvidence({
        inspection,
        pixel,
        visibleMark: {
          provider: "gemini",
          confidence: 0.9,
          region: null,
        },
      }),
    ).toMatchObject({
      kind: "file-evidence",
      explicitAiFileSignalCount: 1,
      visiblePlatformMarkFound: true,
      pixelEstimateAvailable: true,
    })
  })

  it("keeps visual clues and statistical estimates in separate evidence levels", () => {
    expect(
      summarizeImageEvidence({
        inspection: emptyInspection,
        pixel: null,
        visibleMark: {
          provider: "doubao",
          confidence: 0.81,
          region: { x: 1, y: 1, width: 20, height: 10 },
        },
      }).kind,
    ).toBe("visual-clue")

    expect(
      summarizeImageEvidence({
        inspection: emptyInspection,
        pixel,
        visibleMark: null,
      }).kind,
    ).toBe("statistical-estimate")

    expect(
      summarizeImageEvidence({
        inspection: emptyInspection,
        pixel: null,
        visibleMark: null,
      }).kind,
    ).toBe("insufficient")
  })

  it("uses an honest three-state verdict while keeping the visible result simple", () => {
    const aiInspection: ImageInspection = {
      ...emptyInspection,
      signals: [{
        id: "generator",
        label: "Generator",
        value: "ComfyUI",
        group: "ai",
        severity: "high",
      }],
    }
    expect(getSimpleImageVerdict({
      inspection: aiInspection,
      pixel: null,
      visibleMark: null,
    })).toMatchObject({
      aiGenerated: true,
      classification: "ai-generated",
      reliability: "medium",
      aiLikelihoodPercent: 90,
    })

    expect(getSimpleImageVerdict({
      inspection: emptyInspection,
      pixel: { ...pixel, score: 0.08 },
      visibleMark: null,
    })).toMatchObject({
      aiGenerated: false,
      classification: "not-ai-generated",
      reliability: "medium",
      aiLikelihoodPercent: 21,
    })

    expect(getSimpleImageVerdict({
      inspection: emptyInspection,
      pixel,
      visibleMark: null,
    })).toMatchObject({
      aiGenerated: false,
      classification: "uncertain",
      reliability: "low",
    })
  })

  it("exports detector versions, channel availability, and limitations without a combined score", () => {
    const report = buildImageEvidenceReport({
      createdAt: "2026-07-15T00:00:00.000Z",
      file: { name: "sample.png", type: "image/png", bytes: 1200 },
      inspection: emptyInspection,
      pixel,
      visibleMark: null,
      channels: allAvailable,
    })

    expect(report.schema).toBe("tabnative.image-source-evidence")
    expect(report.version).toBe(IMAGE_EVIDENCE_REPORT_VERSION)
    expect(report.inspectedAt).toBe("2026-07-15T00:00:01.000Z")
    expect(report.file).toMatchObject({
      sha256: "a".repeat(64),
      width: 640,
      height: 480,
    })
    expect(report.channels.pixelStatistics).toMatchObject({
      status: "available",
      detector: {
        identifier: IMAGE_PIXEL_DETECTOR_VERSION,
        model: IMAGE_PIXEL_MODEL_ID,
        revision: IMAGE_PIXEL_MODEL_REVISION,
        backend: "wasm",
        secondary: {
          identifier: IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
          model: IMAGE_PIXEL_SECONDARY_MODEL_ID,
          revision: IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
        },
      },
    })
    expect(report.channels.visiblePlatformMarks.supportedProviders).toEqual([
      "gemini",
      "doubao",
      "jimeng",
    ])
    expect(report.summary).toMatchObject({
      classification: "uncertain",
      reliability: "low",
      aiLikelihoodPercent: 62,
      likelihoodCalibration: "evidence-weighted-likelihood-v1",
    })
    expect(report.limitations).toHaveLength(4)
    expect(JSON.stringify(report)).not.toContain("overallScore")
  })

  it("preserves a useful partial report when the pixel and visible-mark channels are unavailable", () => {
    const report = buildImageEvidenceReport({
      file: { name: "sample.png", type: "image/png", bytes: 1200 },
      inspection: emptyInspection,
      pixel: null,
      visibleMark: null,
      channels: {
        provenance: "available",
        visibleMark: "unavailable",
        pixel: "unavailable",
      },
    })

    expect(report.summary.kind).toBe("insufficient")
    expect(report.channels.fileEvidence.status).toBe("available")
    expect(report.channels.visiblePlatformMarks.status).toBe("unavailable")
    expect(report.channels.pixelStatistics).toMatchObject({
      status: "unavailable",
      result: null,
    })
  })

  it("renders a simple verdict and keeps technical evidence out of the visible result", () => {
    expect(IMAGE_INSPECTOR_MAX_PIXELS).toBe(24_000_000)
    expect(source).toContain("是 AI 生成")
    expect(source).toContain("不是 AI 生成")
    expect(source).toContain("无法确认")
    expect(source).toContain("AI 可能性")
    expect(source).toContain("换一张图片")
    expect(source).toContain("下载检测报告")
    expect(source).toContain("const SHOW_INLINE_TECHNICAL_REPORT = false")
    expect(source).toContain("allowSecondary")
    expect(source).toContain("正在准备增强检测")
    expect(source).toContain("useState<File | null>(null)")
    expect(source).not.toContain("loadSample")
    expect(source).not.toContain("带 AI 来源记录的样例")
    expect(source).not.toContain("无来源记录的 AI 样例")
    expect(source).toMatch(/loadLocalAsset\(assetId\)/)
    expect(source).toMatch(/validateImageFile\(\s*incoming,/)
    expect(source.indexOf("return new Promise<PixelDetectionResult>")).toBeLessThan(source.indexOf("new Worker("))
    expect(source).toContain("analysisAbortRef.current?.abort()")
    expect(source).toContain("abortController.signal.aborted")
    expect(source).not.toContain("await Promise.allSettled")
    expect(source).not.toContain("ScoreDial")
    expect(source).not.toContain('variant="destructive"')
  })
})
