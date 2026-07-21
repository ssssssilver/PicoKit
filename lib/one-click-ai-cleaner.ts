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

export const MAX_AUTOMATIC_VISIBLE_MARK_PASSES = 3

type VisibleMarkCleanupPass<T> = {
  value: T
  mark: VisibleAiMarkDetection | null
}

export type AutomaticVisibleMarkCleanupResult<T> = {
  value: T
  firstMark: VisibleAiMarkDetection | null
  remainingMark: VisibleAiMarkDetection | null
  passes: number
  verified: boolean
}

export async function retryVisibleMarkCleanup<T>(
  initialValue: T,
  repair: (value: T, target: VisibleAiMarkDetection | null) => Promise<VisibleMarkCleanupPass<T>>,
  inspect: (value: T) => Promise<VisibleAiMarkDetection | null>,
  maxPasses = MAX_AUTOMATIC_VISIBLE_MARK_PASSES,
  initialTarget: VisibleAiMarkDetection | null = null,
): Promise<AutomaticVisibleMarkCleanupResult<T>> {
  const passLimit = Math.max(0, Math.floor(maxPasses))
  let value = initialValue
  let firstMark: VisibleAiMarkDetection | null = null
  let passes = 0

  if (passLimit > 0) {
    const initial = await repair(value, initialTarget)
    if (initial.mark) {
      value = initial.value
      firstMark = initial.mark
      passes = 1
    }
  }

  let remainingMark = await inspect(value)
  while (remainingMark && passes < passLimit) {
    const next = await repair(value, remainingMark)
    if (!next.mark) break
    value = next.value
    firstMark ??= next.mark
    passes += 1
    remainingMark = await inspect(value)
  }

  return {
    value,
    firstMark,
    remainingMark,
    passes,
    verified: remainingMark === null,
  }
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

function canvasOutputType(type?: string) {
  return type === "image/jpeg" || type === "image/webp" ? type : "image/png"
}

async function canvasBlob(canvas: HTMLCanvasElement | OffscreenCanvas, requestedType?: string) {
  const type = canvasOutputType(requestedType)
  const quality = type === "image/png" ? undefined : 0.95
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type, quality })
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("result-encode-failed")),
      type,
      quality,
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

async function removeSupportedVisibleMark(
  file: File,
  target: VisibleAiMarkDetection | null = null,
  requestedOutputType?: string,
) {
  const image = await loadImage(file)
  const canvas = imageCanvas(image)
  if (target?.region) {
    cloneFillRegion(canvas, target.region)
    return {
      blob: await canvasBlob(canvas, requestedOutputType),
      mark: target,
    }
  }

  const textMark = target
    ? null
    : (await Promise.all([
      detectTextWatermark(canvas, "doubao"),
      detectTextWatermark(canvas, "jimeng"),
    ]))
      .filter((item) => item.detected)
      .sort((left, right) => right.confidence - left.confidence)[0]

  if (textMark) {
    cloneFillRegion(canvas, textMark.region)
    return {
      blob: await canvasBlob(canvas, requestedOutputType),
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
    blob: await canvasBlob(result.canvas as HTMLCanvasElement | OffscreenCanvas, requestedOutputType),
    mark: {
      provider: "gemini",
      confidence: geminiDetectionConfidence(meta),
      region: meta?.position ?? null,
    } satisfies VisibleAiMarkDetection,
  }
}

export async function cleanAiImageMarks(file: File): Promise<OneClickAiCleanupResult> {
  const repair = async (
    source: Blob,
    target: VisibleAiMarkDetection | null,
    outputType?: string,
  ) => {
    const current = new File([source], file.name, { type: source.type || file.type })
    const repaired = await removeSupportedVisibleMark(current, target, outputType)
    return { value: repaired.blob, mark: repaired.mark }
  }
  const inspectVisibleMark = (source: Blob) => detectVisibleAiPlatformMark(source)
  const visible = await retryVisibleMarkCleanup(
    file as Blob,
    (source, target) => repair(source, target),
    inspectVisibleMark,
  )
  const normalized = await normalizeForImageDelivery(visible.value)
  const normalizedExtension = extensionFor(normalized.format)
  const workingName = `${baseName(file.name)}-delivery-normalized.${normalizedExtension}`
  const workingFile = new File([normalized.blob], workingName, { type: normalized.format })
  let sanitized: SanitizeResult = await sanitizeImage(workingFile, "all")
  let visibleMark = visible.firstMark
  let automaticPasses = visible.passes
  let remainingVisibleMark = await inspectVisibleMark(sanitized.blob)

  if (remainingVisibleMark && automaticPasses < MAX_AUTOMATIC_VISIBLE_MARK_PASSES) {
    const finalCleanup = await retryVisibleMarkCleanup(
      sanitized.blob,
      (source, target) => repair(source, target, source.type || sanitized.blob.type),
      inspectVisibleMark,
      MAX_AUTOMATIC_VISIBLE_MARK_PASSES - automaticPasses,
      remainingVisibleMark,
    )
    automaticPasses += finalCleanup.passes
    visibleMark ??= finalCleanup.firstMark
    if (finalCleanup.passes > 0) {
      const repairedFile = new File(
        [finalCleanup.value],
        `${baseName(file.name)}-auto-repaired.${extensionFor(finalCleanup.value.type)}`,
        { type: finalCleanup.value.type },
      )
      sanitized = await sanitizeImage(repairedFile, "all")
    }
    remainingVisibleMark = await inspectVisibleMark(sanitized.blob)
  }

  const outputName = `${baseName(file.name)}-ai-marks-cleaned.${extensionFor(sanitized.blob.type)}`

  return {
    blob: sanitized.blob,
    name: outputName,
    visibleMark,
    metadataRemoved: sanitized.removed,
    metadataResetByReencode: true,
    containerVerified: sanitized.pixelsPreserved,
    visibleMarkVerified: remainingVisibleMark === null,
    normalizationSteps: normalized.steps,
  }
}
