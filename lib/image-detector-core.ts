import type { ImageInspection } from "@/lib/image-types"

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
  pixelScore: number
  provenanceSignalCount: number
  strongProvenanceSignalCount: number
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

export function fuseImageDetection(pixel: PixelDetectionResult, inspection: ImageInspection): FusedImageDetection {
  const provenance = inspection.signals.filter((signal) => signal.group === "ai")
  const strong = provenance.filter((signal) => signal.severity === "high")
  const pixelHigher = pixel.score >= 0.72
  const pixelLower = pixel.score <= 0.28
  const provenanceHigher = strong.length > 0

  let band: ImageDetectionBand = "uncertain"
  if (provenanceHigher || pixelHigher) band = "higher-ai-signals"
  else if (pixelLower) band = "lower-ai-signals"

  let evidenceAgreement: FusedImageDetection["evidenceAgreement"] = "insufficient"
  if (provenance.length && pixelHigher) evidenceAgreement = "agree"
  else if (provenanceHigher && pixelLower) evidenceAgreement = "conflict"
  else if (provenance.length) evidenceAgreement = "provenance-only"
  else if (pixelHigher || pixelLower) evidenceAgreement = "pixel-only"

  let reliability: ImageDetectionReliability = "low"
  if (evidenceAgreement === "agree" && pixel.consistency >= 0.65) reliability = "high"
  else if (provenanceHigher || ((pixelHigher || pixelLower) && pixel.consistency >= 0.6)) reliability = "medium"
  if (evidenceAgreement === "conflict") reliability = "low"

  return {
    band,
    reliability,
    pixelScore: pixel.score,
    provenanceSignalCount: provenance.length,
    strongProvenanceSignalCount: strong.length,
    evidenceAgreement,
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5))
}
