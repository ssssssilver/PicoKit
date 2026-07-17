import type { ImageInspection } from "@/lib/image-types"
import type { VisibleAiMarkDetection } from "@/lib/visible-watermark"

export const IMAGE_PIXEL_MODEL_ID = "onnx-community/ai-image-detect-distilled-ONNX"
export const IMAGE_PIXEL_MODEL_REVISION = "7f067e23521eeb6d6525221af82c613fb746aaff"
export const IMAGE_PIXEL_DETECTOR_VERSION = `${IMAGE_PIXEL_MODEL_ID}@${IMAGE_PIXEL_MODEL_REVISION}`

export type ImageClassifierLabel = { label: string; score: number }

export type ImageViewScore = {
  view: string
  score: number
}

export type PixelDetectionResult = {
  score: number
  consistency: number
  spread: number
  backend: string
  model: string
  views: ImageViewScore[]
}

export type ImageDetectionBand = "higher-ai-signals" | "uncertain" | "lower-ai-signals"
export type ImageDetectionReliability = "high" | "medium" | "low"

export type FusedImageDetection = {
  band: ImageDetectionBand
  reliability: ImageDetectionReliability
  overallScore: number
  pixelScore: number | null
  provenanceSignalCount: number
  strongProvenanceSignalCount: number
  visibleMarkSignalCount: number
  evidenceAgreement: "agree" | "conflict" | "pixel-only" | "provenance-only" | "insufficient"
}

const AI_LABEL = /(^|\b)(fake|ai|artificial|generated|synthetic)(\b|$)/i
const REAL_LABEL = /(^|\b)(real|human|camera|natural|authentic)(\b|$)/i

export function aiImageScore(labels: ImageClassifierLabel[]) {
  const ai = labels.find((item) => AI_LABEL.test(item.label))
  if (ai) return clamp(ai.score)
  const real = labels.find((item) => REAL_LABEL.test(item.label))
  if (real) return clamp(1 - real.score)
  return clamp(labels[0]?.score ?? 0.5)
}

export function aggregateImageViews(outputs: ImageClassifierLabel[][], viewNames: string[], backend: string, model: string): PixelDetectionResult {
  const views = outputs.map((labels, index) => ({ view: viewNames[index] || `view-${index + 1}`, score: aiImageScore(labels) }))
  const score = views.reduce((sum, item) => sum + item.score, 0) / Math.max(1, views.length)
  const variance = views.reduce((sum, item) => sum + (item.score - score) ** 2, 0) / Math.max(1, views.length)
  const spread = Math.sqrt(variance)
  return {
    score,
    consistency: clamp(1 - spread / 0.35),
    spread,
    backend,
    model,
    views,
  }
}

export function attachVisibleAiMarkEvidence(inspection: ImageInspection, mark: VisibleAiMarkDetection | null): ImageInspection {
  if (!mark) return inspection
  const provider = { gemini: "Gemini", doubao: "豆包 / Doubao", jimeng: "即梦 / Jimeng" }[mark.provider]
  const signal = {
    id: `visible-ai-mark-${mark.provider}`,
    label: `${provider} 可见 AI 平台角标`,
    value: `本地像素匹配置信度 ${Math.round(mark.confidence * 100)}%`,
    group: "ai" as const,
    severity: "high" as const,
  }
  return {
    ...inspection,
    signals: [...inspection.signals.filter((item) => item.id !== signal.id), signal],
    risk: "signals-found",
    note: "检测到 AI 平台添加的可见角标。该信号直接说明平台处理痕迹，但仍不单独证明作者身份。",
  }
}

export function fuseImageDetection(pixel: PixelDetectionResult | null, inspection: ImageInspection): FusedImageDetection {
  const provenance = inspection.signals.filter((signal) => signal.group === "ai")
  const strong = provenance.filter((signal) => signal.severity === "high")
  const visibleMarks = provenance.filter((signal) => signal.id.startsWith("visible-ai-mark-"))
  const pixelHigher = Boolean(pixel && pixel.score >= 0.72)
  const pixelLower = Boolean(pixel && pixel.score <= 0.28)
  const provenanceHigher = strong.length > 0
  const evidenceFloor = visibleMarks.length ? 0.94 : strong.length ? 0.86 : provenance.length ? 0.66 : 0
  const overallScore = clamp(Math.max(pixel?.score ?? 0.5, evidenceFloor))

  let band: ImageDetectionBand = "uncertain"
  if (provenanceHigher || pixelHigher) band = "higher-ai-signals"
  else if (pixelLower) band = "lower-ai-signals"

  let evidenceAgreement: FusedImageDetection["evidenceAgreement"] = "insufficient"
  if (provenance.length && pixelHigher) evidenceAgreement = "agree"
  else if (provenanceHigher && pixelLower) evidenceAgreement = "conflict"
  else if (provenance.length) evidenceAgreement = "provenance-only"
  else if (pixelHigher || pixelLower) evidenceAgreement = "pixel-only"

  let reliability: ImageDetectionReliability = "low"
  if (evidenceAgreement === "agree" && (pixel?.consistency ?? 0) >= 0.65) reliability = "high"
  else if (provenanceHigher || ((pixelHigher || pixelLower) && (pixel?.consistency ?? 0) >= 0.6)) reliability = "medium"
  if (evidenceAgreement === "conflict" && !visibleMarks.length) reliability = "low"

  return {
    band,
    reliability,
    overallScore,
    pixelScore: pixel?.score ?? null,
    provenanceSignalCount: provenance.length,
    strongProvenanceSignalCount: strong.length,
    visibleMarkSignalCount: visibleMarks.length,
    evidenceAgreement,
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5))
}
