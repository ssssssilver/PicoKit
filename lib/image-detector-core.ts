import type { ImageInspection } from "@/lib/image-types"
import type { VisibleAiMarkDetection } from "@/lib/visible-watermark"

export const IMAGE_PIXEL_MODEL_ID = "onnx-community/ai-image-detect-distilled-ONNX"
export const IMAGE_PIXEL_MODEL_REVISION = "7f067e23521eeb6d6525221af82c613fb746aaff"
export const IMAGE_PIXEL_DETECTOR_VERSION = `${IMAGE_PIXEL_MODEL_ID}@${IMAGE_PIXEL_MODEL_REVISION}`
export const IMAGE_PIXEL_SECONDARY_MODEL_ID = "onnx-community/ai-source-detector-ONNX"
export const IMAGE_PIXEL_SECONDARY_MODEL_REVISION = "9a1c4127b96f6b76e7674c01af2642bf248e5950"
export const IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION = `${IMAGE_PIXEL_SECONDARY_MODEL_ID}@${IMAGE_PIXEL_SECONDARY_MODEL_REVISION}`
export const IMAGE_PIXEL_CASCADE_VERSION = "tabnative/image-pixel-cascade@3"
export const IMAGE_PIXEL_MIN_MODEL_AGREEMENT = 0.7

export type ImageClassifierLabel = { label: string; score: number }

export type ImageViewScore = {
  view: string
  score: number
}

export type PixelModelResult = {
  score: number
  consistency: number
  spread: number
  backend: string
  model: string
  views: ImageViewScore[]
  aggregation?: "robust-full-region-v2"
  calibration?: "conservative-backend-v1" | "conservative-cascade-v1"
}

export type PixelCascadeState = "not-needed" | "completed" | "unavailable" | "skipped"

export type PixelDetectionResult = PixelModelResult & {
  models?: PixelModelResult[]
  modelAgreement?: number
  cascade?: {
    strategy: "challenge-negative-v1"
    secondary: PixelCascadeState
  }
}

export type ImageViewPlan = {
  name: string
  bounds: [number, number, number, number] | null
}

export type PixelEstimateBand = "higher" | "uncertain" | "lower"

export type ImageDetectionBand = "higher-ai-signals" | "uncertain" | "lower-ai-signals"
export type ImageDetectionReliability = "high" | "medium" | "low"

export type FusedImageDetection = {
  band: ImageDetectionBand
  reliability: ImageDetectionReliability
  overallScore: number
  calibration: "evidence-weighted-likelihood-v1"
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

export function buildImageViewPlan(width: number, height: number): ImageViewPlan[] {
  const plan: ImageViewPlan[] = [{ name: "full", bounds: null }]
  const side = Math.min(width, height)
  if (side < 320) return plan

  const maxX = width - side
  const maxY = height - side
  // A square crop would be byte-for-byte identical to the full image. Keeping
  // both would double-count the same evidence and inflate consistency.
  if (maxX === 0 && maxY === 0) return plan

  const positions: Array<[string, number, number]> = [
    ["center", Math.round(maxX / 2), Math.round(maxY / 2)],
    ["top-left", 0, 0],
    ["top-right", maxX, 0],
    ["bottom-left", 0, maxY],
    ["bottom-right", maxX, maxY],
  ]
  const seen = new Set<string>()
  for (const [name, x, y] of positions) {
    const key = `${x}:${y}:${side}`
    if (seen.has(key)) continue
    seen.add(key)
    plan.push({ name, bounds: [x, y, x + side - 1, y + side - 1] })
  }
  return plan
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export function aggregateImageViews(outputs: ImageClassifierLabel[][], viewNames: string[], backend: string, model: string): PixelModelResult {
  const views = outputs.map((labels, index) => ({ view: viewNames[index] || `view-${index + 1}`, score: aiImageScore(labels) }))
  const full = views.find((item) => item.view === "full") ?? views[0]
  if (!full) {
    return {
      score: 0.5,
      consistency: 0,
      spread: 1,
      backend,
      model,
      views,
      aggregation: "robust-full-region-v2",
      calibration: "conservative-backend-v1",
    }
  }
  const regionalScores = views.filter((item) => item !== full).map((item) => item.score)
  // Keep the whole image as the primary observation and use the median of
  // unique regions as supporting evidence. A single noisy corner can no
  // longer dominate the result.
  const score = clamp(
    regionalScores.length
      ? full.score * 0.6 + median(regionalScores) * 0.4
      : full.score,
  )
  const variance = views.reduce((sum, item) => sum + (item.score - score) ** 2, 0) / Math.max(1, views.length)
  const spread = Math.sqrt(variance)
  return {
    score,
    consistency: clamp(1 - spread / 0.35),
    spread,
    backend,
    model,
    views,
    aggregation: "robust-full-region-v2",
    calibration: "conservative-backend-v1",
  }
}

function singlePixelEstimateBand(pixel: PixelModelResult): PixelEstimateBand {
  // Region disagreement is more informative than a precise-looking score.
  // Keep conflicting observations in the uncertain band on every backend.
  if (pixel.consistency < 0.55 || pixel.spread > 0.22) return "uncertain"

  // Quantized WASM inference gets a wider uncertainty interval until a
  // browser/backend regression set proves that tighter thresholds are safe.
  const thresholds = pixel.backend === "wasm"
    ? { lower: 0.18, higher: 0.82 }
    : { lower: 0.22, higher: 0.78 }
  if (pixel.score >= thresholds.higher) return "higher"
  if (pixel.score <= thresholds.lower) return "lower"
  return "uncertain"
}

export function pixelEstimateBand(pixel: PixelDetectionResult): PixelEstimateBand {
  const models = pixel.models?.length ? pixel.models : [pixel]
  const primaryBand = singlePixelEstimateBand(models[0])
  const secondary = models[1]
  if (!secondary) return primaryBand

  const secondaryBand = singlePixelEstimateBand(secondary)
  const modelAgreement = clamp(pixel.modelAgreement ?? (1 - Math.abs(models[0].score - secondary.score)))
  // The enhanced model exists to challenge a weak or negative first pass.
  // It may promote an uncertain result only when both model scores still point
  // in a compatible direction. Large score gaps are model conflict, even when
  // the first score sits just inside the broad uncertainty band.
  if (modelAgreement < IMAGE_PIXEL_MIN_MODEL_AGREEMENT) return "uncertain"
  if (secondaryBand === "uncertain") return "uncertain"
  if (primaryBand === "uncertain" || primaryBand === secondaryBand) {
    return secondaryBand
  }
  return "uncertain"
}

export function shouldRunSecondaryPixelModel(primary: PixelModelResult) {
  return singlePixelEstimateBand(primary) !== "higher"
}

export function combinePixelModelResults(
  primary: PixelModelResult,
  secondary: PixelModelResult | null,
  secondaryState: PixelCascadeState,
): PixelDetectionResult {
  if (!secondary) {
    return {
      ...primary,
      models: [primary],
      modelAgreement: 1,
      cascade: {
        strategy: "challenge-negative-v1",
        secondary: secondaryState,
      },
    }
  }

  const modelAgreement = clamp(1 - Math.abs(primary.score - secondary.score))
  const provisional: PixelDetectionResult = {
    ...primary,
    models: [primary, secondary],
    modelAgreement,
    cascade: {
      strategy: "challenge-negative-v1",
      secondary: secondaryState,
    },
  }
  const primaryBand = singlePixelEstimateBand(primary)
  const secondaryBand = singlePixelEstimateBand(secondary)
  const combinedBand = pixelEstimateBand(provisional)
  let score = clamp(primary.score * 0.4 + secondary.score * 0.6)
  if (modelAgreement < IMAGE_PIXEL_MIN_MODEL_AGREEMENT) {
    score = 0.5
  } else if (primaryBand === "uncertain" && combinedBand !== "uncertain") {
    score = secondary.score
  } else if (
    primaryBand !== "uncertain" &&
    secondaryBand !== "uncertain" &&
    primaryBand !== secondaryBand
  ) {
    score = 0.5
  }

  return {
    ...provisional,
    score,
    consistency: Math.min(primary.consistency, secondary.consistency),
    spread: Math.max(primary.spread, secondary.spread),
    backend: Array.from(new Set([primary.backend, secondary.backend])).join(" + "),
    model: IMAGE_PIXEL_CASCADE_VERSION,
    calibration: "conservative-cascade-v1",
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
  const pixelBand = pixel ? pixelEstimateBand(pixel) : null
  const pixelHigher = pixelBand === "higher"
  const pixelLower = pixelBand === "lower"
  const provenanceHigher = strong.length > 0
  const c2paBackedAiSignal = strong.some((signal) => signal.id.startsWith("c2pa-ai-"))
    && inspection.c2pa.present
    && inspection.c2pa.validated === true
  const trustedC2paBackedAiSignal = c2paBackedAiSignal && inspection.c2pa.trust === "trusted"
  const evidenceFloor = trustedC2paBackedAiSignal
    ? 0.99
    : c2paBackedAiSignal
      ? 0.97
      : visibleMarks.length
        ? 0.94
        : strong.length
          ? 0.9
          : provenance.length
            ? 0.7
            : 0
  const pixelLikelihood = calibratedPixelAiLikelihood(pixel)
  const overallScore = clamp(Math.max(pixelLikelihood, evidenceFloor))

  let band: ImageDetectionBand = "uncertain"
  if (provenanceHigher || pixelHigher) band = "higher-ai-signals"
  else if (pixelLower) band = "lower-ai-signals"

  let evidenceAgreement: FusedImageDetection["evidenceAgreement"] = "insufficient"
  if (provenance.length && pixelHigher) evidenceAgreement = "agree"
  else if (provenanceHigher && pixelLower) evidenceAgreement = "conflict"
  else if (provenance.length) evidenceAgreement = "provenance-only"
  else if (pixelHigher || pixelLower) evidenceAgreement = "pixel-only"

  let reliability: ImageDetectionReliability = "low"
  const modelAgreement = pixel?.modelAgreement ?? 1
  const pixelSupported = modelAgreement >= IMAGE_PIXEL_MIN_MODEL_AGREEMENT
  if (evidenceAgreement === "agree" && pixelSupported && (pixel?.consistency ?? 0) >= 0.65) reliability = "high"
  else if (provenanceHigher || (pixelSupported && (pixelHigher || pixelLower) && (pixel?.consistency ?? 0) >= 0.6)) reliability = "medium"
  if (evidenceAgreement === "conflict" && !visibleMarks.length) reliability = "low"

  return {
    band,
    reliability,
    overallScore,
    calibration: "evidence-weighted-likelihood-v1",
    pixelScore: pixel?.score ?? null,
    provenanceSignalCount: provenance.length,
    strongProvenanceSignalCount: strong.length,
    visibleMarkSignalCount: visibleMarks.length,
    evidenceAgreement,
  }
}

/**
 * Shrink classifier scores toward 50% unless regional consistency and model
 * agreement support a stronger result. This is an evidence-weighted likelihood
 * for the product UI, not the raw softmax output of either classifier.
 */
export function calibratedPixelAiLikelihood(pixel: PixelDetectionResult | null) {
  if (!pixel) return 0.5
  const band = pixelEstimateBand(pixel)
  const agreement = clamp(pixel.modelAgreement ?? 1)
  const support = clamp(pixel.consistency) * agreement
  const weight = 0.42 + support * 0.38
  let likelihood = 0.5 + (clamp(pixel.score) - 0.5) * weight
  if (band === "higher") likelihood = Math.max(likelihood, 0.68)
  if (band === "lower") likelihood = Math.min(likelihood, 0.32)
  if (band === "uncertain") likelihood = Math.max(0.38, Math.min(0.62, likelihood))
  return clamp(likelihood)
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5))
}
