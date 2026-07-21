import { sanitizeImage } from "@/lib/image-sanitizer"
import type { SanitizeResult } from "@/lib/image-types"
import { normalizeForImageDelivery } from "@/lib/browser-camera-normalizer"
import {
  cloneFillRegion,
  detectVisibleAiPlatformMark,
  detectTextWatermark,
  geminiDetectionConfidence,
  isGeminiRemovalCandidate,
  type GeminiDetectionMeta,
  type VisibleAiMarkDetection,
} from "@/lib/visible-watermark"

export type OneClickAiCleanupResult = {
  blob: Blob
  name: string
  visibleMark: VisibleAiMarkDetection | null
  metadataRemoved: string[]
  metadataResetByReencode: boolean
  containerVerified: boolean
  visibleMarkVerified: boolean
  normalizationSteps: string[]
}

async function loadImage(source: Blob) {
  const url = URL.createObjectURL(source)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("image-decode-failed"))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function imageCanvas(image: HTMLImageElement) {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("canvas-unavailable")
  context.drawImage(image, 0, 0)
  return canvas
}

async function canvasPng(canvas: HTMLCanvasElement | OffscreenCanvas) {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: "image/png" })
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("result-encode-failed")),
      "image/png",
    )
  })
}

function extensionFor(mime: string) {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/webp") return "webp"
  return "png"
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "tabnative-image"
}

async function removeSupportedVisibleMark(file: File) {
  const image = await loadImage(file)
  const canvas = imageCanvas(image)
  const detections = await Promise.all([
    detectTextWatermark(canvas, "doubao"),
    detectTextWatermark(canvas, "jimeng"),
  ])
  const textMark = detections
    .filter((item) => item.detected)
    .sort((left, right) => right.confidence - left.confidence)[0]

  if (textMark) {
    cloneFillRegion(canvas, textMark.region)
    return {
      blob: await canvasPng(canvas),
      mark: {
        provider: textMark.provider,
        confidence: textMark.confidence,
        region: textMark.region,
      } satisfies VisibleAiMarkDetection,
    }
  }

  const { removeWatermarkFromImage } = await import("@pilio/gemini-watermark-remover/browser")
  const result = await removeWatermarkFromImage(image, { adaptiveMode: "auto" })
  const meta = result.meta as GeminiDetectionMeta | null
  if (!isGeminiRemovalCandidate(meta, image.naturalWidth, image.naturalHeight)) {
    return { blob: file as Blob, mark: null }
  }

  return {
    blob: await canvasPng(result.canvas as HTMLCanvasElement | OffscreenCanvas),
    mark: {
      provider: "gemini",
      confidence: geminiDetectionConfidence(meta),
      region: null,
    } satisfies VisibleAiMarkDetection,
  }
}

export async function cleanAiImageMarks(file: File): Promise<OneClickAiCleanupResult> {
  const visible = await removeSupportedVisibleMark(file)
  const normalized = await normalizeForImageDelivery(visible.blob)
  const normalizedExtension = extensionFor(normalized.format)
  const workingName = `${baseName(file.name)}-delivery-normalized.${normalizedExtension}`
  const workingFile = new File([normalized.blob], workingName, { type: normalized.format })
  const sanitized: SanitizeResult = await sanitizeImage(workingFile, "all")
  const outputName = `${baseName(file.name)}-ai-marks-cleaned.${extensionFor(sanitized.blob.type)}`
  const remainingVisibleMark = await detectVisibleAiPlatformMark(sanitized.blob)

  return {
    blob: sanitized.blob,
    name: outputName,
    visibleMark: visible.mark,
    metadataRemoved: sanitized.removed,
    metadataResetByReencode: true,
    containerVerified: sanitized.pixelsPreserved,
    visibleMarkVerified: remainingVisibleMark === null,
    normalizationSteps: normalized.steps,
  }
}
