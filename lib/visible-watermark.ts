export type VisibleWatermarkProvider = "doubao" | "jimeng"

export type PixelRect = { x: number; y: number; width: number; height: number }

export type TextWatermarkDetection = {
  provider: VisibleWatermarkProvider
  detected: boolean
  confidence: number
  coverage: number
  region: PixelRect
}

export type VisibleAiMarkDetection = {
  provider: "gemini" | VisibleWatermarkProvider
  confidence: number
  region: PixelRect | null
}

export const VISIBLE_MARK_MAX_EDGE = 2048
export const VISIBLE_MARK_MAX_PIXELS = 4_000_000

export type VisibleMarkAnalysisOptions = {
  sourceWidth?: number
  sourceHeight?: number
  maxEdge?: number
  maxPixels?: number
  signal?: AbortSignal
}

export type GeminiDetectionMeta = {
  applied?: boolean
  position?: PixelRect | null
  source?: string | null
  decisionTier?: string | null
  detection?: {
    adaptiveConfidence?: number | null
    originalSpatialScore?: number | null
    originalGradientScore?: number | null
    processedSpatialScore?: number | null
    suppressionGain?: number | null
  }
}

const GEMINI_MIN_CONFIDENCE = 0.9
const GEMINI_MIN_SPATIAL_SCORE = 0.32
const GEMINI_MIN_GRADIENT_SCORE = 0.15
const GEMINI_MAX_PROCESSED_SPATIAL_SCORE = 0.18
const GEMINI_MIN_SUPPRESSION_GAIN = 0.3

type ProviderConfig = {
  provider: VisibleWatermarkProvider
  asset: string
  widthFrac: number
  heightFrac: number
  marginXFrac: number
  marginBottomFrac: number
  alphaWidthFrac: number
  alphaHeightFrac: number
  minCoverage: number
  threshold: number
}

const CONFIGS: Record<VisibleWatermarkProvider, ProviderConfig> = {
  doubao: {
    provider: "doubao",
    asset: "/watermarks/doubao-alpha.png",
    widthFrac: 0.22,
    heightFrac: 0.075,
    marginXFrac: 0.004,
    marginBottomFrac: 0.004,
    alphaWidthFrac: 0.1636,
    alphaHeightFrac: 0.0405,
    minCoverage: 0.025,
    threshold: 0.43,
  },
  jimeng: {
    provider: "jimeng",
    asset: "/watermarks/jimeng-alpha.png",
    widthFrac: 0.27,
    heightFrac: 0.092,
    marginXFrac: 0.008,
    marginBottomFrac: 0.01,
    alphaWidthFrac: 0.2021,
    alphaHeightFrac: 0.0576,
    minCoverage: 0.015,
    threshold: 0.46,
  },
}

const templateCache = new Map<string, Promise<HTMLCanvasElement>>()

export function getProviderConfig(provider: VisibleWatermarkProvider) {
  return CONFIGS[provider]
}

export function clampRect(rect: PixelRect, imageWidth: number, imageHeight: number): PixelRect {
  const x = Math.max(0, Math.min(imageWidth - 1, Math.round(rect.x)))
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(rect.y)))
  const width = Math.max(1, Math.min(imageWidth - x, Math.round(rect.width)))
  const height = Math.max(1, Math.min(imageHeight - y, Math.round(rect.height)))
  return { x, y, width, height }
}

export function normalizeDragRect(startX: number, startY: number, endX: number, endY: number): PixelRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }
}

export function visibleMarkAnalysisSize(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge = VISIBLE_MARK_MAX_EDGE,
  maxPixels = VISIBLE_MARK_MAX_PIXELS,
) {
  const width = Number.isFinite(sourceWidth) && sourceWidth > 0 ? Math.max(1, Math.round(sourceWidth)) : 1
  const height = Number.isFinite(sourceHeight) && sourceHeight > 0 ? Math.max(1, Math.round(sourceHeight)) : 1
  const edgeScale = Math.min(1, Math.max(1, maxEdge) / Math.max(width, height))
  const pixelScale = Math.min(1, Math.sqrt(Math.max(1, maxPixels) / (width * height)))
  const scale = Math.min(edgeScale, pixelScale)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

export function isConservativeGeminiDetection(
  meta: GeminiDetectionMeta | null | undefined,
  imageWidth: number,
  imageHeight: number,
) {
  if (!meta?.applied || !meta.position) return false
  const detection = meta.detection
  const confidence = detection?.adaptiveConfidence
  const spatial = detection?.originalSpatialScore
  const gradient = detection?.originalGradientScore
  const processedSpatial = detection?.processedSpatialScore
  const suppressionGain = detection?.suppressionGain
  const position = meta.position
  const rightGap = imageWidth - (position.x + position.width)
  const bottomGap = imageHeight - (position.y + position.height)
  const markSize = Math.max(position.width, position.height)
  const squareTolerance = Math.max(3, markSize * 0.15)
  const isBottomRight = position.x >= imageWidth * 0.5
    && position.y >= imageHeight * 0.5
    && rightGap >= -1
    && bottomGap >= -1
    && rightGap <= Math.max(128, position.width * 2)
    && bottomGap <= Math.max(128, position.height * 2)
    && Math.abs(position.width - position.height) <= squareTolerance
    && markSize >= 24
    && markSize <= Math.min(imageWidth, imageHeight) * 0.25
  if (!isBottomRight) return false

  // Current SDK releases expose a production validation tier even when the
  // optional adaptive-confidence field is null. That tier is a stronger
  // signal than removal-quality metrics, which describe the output image and
  // previously caused genuine Gemini marks to be discarded.
  const sdkValidated = meta.decisionTier === "validated-match"
    && typeof meta.source === "string"
    && meta.source !== "skipped"
    && [confidence, spatial, gradient, suppressionGain].some(Number.isFinite)
  if (sdkValidated) return true

  // Preserve the stricter legacy path for older SDK metadata that does not
  // expose decisionTier.
  return [confidence, spatial, gradient, processedSpatial, suppressionGain].every(Number.isFinite)
    && Number(confidence) >= GEMINI_MIN_CONFIDENCE
    && Number(spatial) >= GEMINI_MIN_SPATIAL_SCORE
    && Number(gradient) >= GEMINI_MIN_GRADIENT_SCORE
    && Number(processedSpatial) <= GEMINI_MAX_PROCESSED_SPATIAL_SCORE
    && Number(suppressionGain) >= GEMINI_MIN_SUPPRESSION_GAIN
}

export function geminiDetectionConfidence(meta: GeminiDetectionMeta | null | undefined) {
  const adaptive = Number(meta?.detection?.adaptiveConfidence)
  const spatial = Number(meta?.detection?.originalSpatialScore)
  const candidates = [adaptive, spatial].filter((value) => Number.isFinite(value) && value > 0)
  const measured = candidates.length ? Math.max(...candidates) : 0
  const floor = meta?.decisionTier === "validated-match" ? 0.94 : 0.9
  return Math.min(0.99, Math.max(floor, measured))
}

export function locateProviderRegion(provider: VisibleWatermarkProvider, imageWidth: number, imageHeight: number): PixelRect {
  const config = CONFIGS[provider]
  const width = Math.max(40, Math.round(imageWidth * config.widthFrac))
  const height = Math.max(16, Math.round(imageWidth * config.heightFrac))
  const marginX = Math.max(4, Math.round(imageWidth * config.marginXFrac))
  const marginBottom = Math.max(4, Math.round(imageWidth * config.marginBottomFrac))
  return clampRect({ x: imageWidth - marginX - width, y: imageHeight - marginBottom - height, width, height }, imageWidth, imageHeight)
}

async function loadTemplate(asset: string) {
  let pending = templateCache.get(asset)
  if (!pending) {
    pending = new Promise<HTMLCanvasElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        canvas.getContext("2d", { willReadFrequently: true })?.drawImage(image, 0, 0)
        resolve(canvas)
      }
      image.onerror = () => reject(new Error("watermark-template-unavailable"))
      image.src = asset
    })
    templateCache.set(asset, pending)
  }
  return pending
}

function makeCandidateMask(data: ImageData) {
  const { width, height } = data
  const luma = new Float32Array(width * height)
  const grayish = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4
    const r = data.data[offset]
    const g = data.data[offset + 1]
    const b = data.data[offset + 2]
    luma[i] = (r + g + b) / 3
    grayish[i] = Math.max(r, g, b) - Math.min(r, g, b) < 55 ? 1 : 0
  }

  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let row = 0
    for (let x = 0; x < width; x += 1) {
      row += luma[y * width + x]
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row
    }
  }

  const radius = Math.max(4, Math.round(height * 0.22))
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius)
    const y2 = Math.min(height, y + radius + 1)
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius)
      const x2 = Math.min(width, x + radius + 1)
      const sum = integral[y2 * (width + 1) + x2] - integral[y1 * (width + 1) + x2] - integral[y2 * (width + 1) + x1] + integral[y1 * (width + 1) + x1]
      const localBackground = sum / ((x2 - x1) * (y2 - y1))
      const index = y * width + x
      if (grayish[index] && luma[index] > 145 && luma[index] - localBackground > 9) mask[index] = 1
    }
  }
  return mask
}

function downsampleMask(source: Uint8Array, sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const output = new Uint8Array(targetWidth * targetHeight)
  for (let y = 0; y < targetHeight; y += 1) {
    const sy1 = Math.floor((y * sourceHeight) / targetHeight)
    const sy2 = Math.max(sy1 + 1, Math.ceil(((y + 1) * sourceHeight) / targetHeight))
    for (let x = 0; x < targetWidth; x += 1) {
      const sx1 = Math.floor((x * sourceWidth) / targetWidth)
      const sx2 = Math.max(sx1 + 1, Math.ceil(((x + 1) * sourceWidth) / targetWidth))
      let active = 0
      let total = 0
      for (let sy = sy1; sy < sy2; sy += 1) for (let sx = sx1; sx < sx2; sx += 1) {
        active += source[sy * sourceWidth + sx]
        total += 1
      }
      output[y * targetWidth + x] = active / total >= 0.22 ? 1 : 0
    }
  }
  return output
}

function templateMask(canvas: HTMLCanvasElement, width: number, height: number) {
  const resized = document.createElement("canvas")
  resized.width = width
  resized.height = height
  const context = resized.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("canvas-context-unavailable")
  context.drawImage(canvas, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  // The reference PNGs intentionally use an opaque black background; alpha is
  // therefore not a glyph mask. Match only their visible light pixels.
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4
    mask[i] = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 38 ? 1 : 0
  }
  return mask
}

function matchMask(candidate: Uint8Array, cw: number, ch: number, template: Uint8Array, tw: number, th: number) {
  const active: Array<[number, number]> = []
  for (let y = 0; y < th; y += 1) for (let x = 0; x < tw; x += 1) if (template[y * tw + x]) active.push([x, y])
  const integral = new Uint32Array((cw + 1) * (ch + 1))
  for (let y = 0; y < ch; y += 1) {
    let row = 0
    for (let x = 0; x < cw; x += 1) {
      row += candidate[y * cw + x]
      integral[(y + 1) * (cw + 1) + x + 1] = integral[y * (cw + 1) + x + 1] + row
    }
  }
  let best = { confidence: 0, x: 0, y: 0 }
  for (let y = 0; y <= ch - th; y += 1) for (let x = 0; x <= cw - tw; x += 1) {
    let overlap = 0
    for (const [tx, ty] of active) overlap += candidate[(y + ty) * cw + x + tx]
    const windowCount = integral[(y + th) * (cw + 1) + x + tw] - integral[y * (cw + 1) + x + tw] - integral[(y + th) * (cw + 1) + x] + integral[y * (cw + 1) + x]
    const confidence = overlap / Math.sqrt(Math.max(1, active.length * windowCount))
    if (confidence > best.confidence) best = { confidence, x, y }
  }
  return best
}

export async function detectTextWatermark(source: HTMLCanvasElement, provider: VisibleWatermarkProvider): Promise<TextWatermarkDetection> {
  const config = CONFIGS[provider]
  const region = locateProviderRegion(provider, source.width, source.height)
  if (Math.min(source.width, source.height) < 200) return { provider, detected: false, confidence: 0, coverage: 0, region }
  const context = source.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("canvas-context-unavailable")
  const candidateFull = makeCandidateMask(context.getImageData(region.x, region.y, region.width, region.height))
  const maxWidth = 176
  const scale = Math.min(1, maxWidth / region.width)
  const cw = Math.max(20, Math.round(region.width * scale))
  const ch = Math.max(8, Math.round(region.height * scale))
  const candidate = downsampleMask(candidateFull, region.width, region.height, cw, ch)
  const coverage = candidate.reduce((sum, value) => sum + value, 0) / candidate.length
  const templateCanvas = await loadTemplate(config.asset)
  const tw = Math.min(cw - 1, Math.max(8, Math.round(source.width * config.alphaWidthFrac * scale)))
  const th = Math.min(ch - 1, Math.max(4, Math.round(source.width * config.alphaHeightFrac * scale)))
  const template = templateMask(templateCanvas, tw, th)
  const match = matchMask(candidate, cw, ch, template, tw, th)
  const pad = Math.max(4, Math.round(region.height * 0.08))
  const matched = clampRect({
    x: region.x + match.x / scale - pad,
    y: region.y + match.y / scale - pad,
    width: tw / scale + pad * 2,
    height: th / scale + pad * 2,
  }, source.width, source.height)
  return {
    provider,
    detected: coverage >= config.minCoverage && match.confidence >= config.threshold,
    confidence: match.confidence,
    coverage,
    region: matched,
  }
}

function visibleMarkAbortError() {
  const error = new Error("Visible-mark inspection cancelled")
  error.name = "AbortError"
  return error
}

function throwIfVisibleMarkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw visibleMarkAbortError()
}

function scaleDetectionRegion(region: PixelRect, scaleX: number, scaleY: number) {
  return {
    x: Math.round(region.x * scaleX),
    y: Math.round(region.y * scaleY),
    width: Math.max(1, Math.round(region.width * scaleX)),
    height: Math.max(1, Math.round(region.height * scaleY)),
  }
}

export async function detectVisibleAiPlatformMark(
  source: Blob,
  options: VisibleMarkAnalysisOptions = {},
): Promise<VisibleAiMarkDetection | null> {
  throwIfVisibleMarkAborted(options.signal)
  let bitmap: ImageBitmap | null = null
  try {
    const hasKnownSize = Number.isFinite(options.sourceWidth) && Number.isFinite(options.sourceHeight)
      && Number(options.sourceWidth) > 0 && Number(options.sourceHeight) > 0
    const sourceWidth = hasKnownSize ? Number(options.sourceWidth) : 0
    const sourceHeight = hasKnownSize ? Number(options.sourceHeight) : 0
    const requestedSize = hasKnownSize
      ? visibleMarkAnalysisSize(sourceWidth, sourceHeight, options.maxEdge, options.maxPixels)
      : null
    bitmap = await createImageBitmap(source, requestedSize ? {
      imageOrientation: "from-image",
      resizeWidth: requestedSize.width,
      resizeHeight: requestedSize.height,
      resizeQuality: "high",
    } : { imageOrientation: "from-image" })
    throwIfVisibleMarkAborted(options.signal)

    const actualSourceWidth = hasKnownSize ? sourceWidth : bitmap.width
    const actualSourceHeight = hasKnownSize ? sourceHeight : bitmap.height
    const analysisSize = requestedSize ?? visibleMarkAnalysisSize(
      actualSourceWidth,
      actualSourceHeight,
      options.maxEdge,
      options.maxPixels,
    )
    const canvas = document.createElement("canvas")
    canvas.width = analysisSize.width
    canvas.height = analysisSize.height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("canvas-context-unavailable")
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    bitmap = null
    throwIfVisibleMarkAborted(options.signal)

    const textDetections = await Promise.all([
      detectTextWatermark(canvas, "doubao"),
      detectTextWatermark(canvas, "jimeng"),
    ])
    throwIfVisibleMarkAborted(options.signal)
    const bestText = textDetections.filter((item) => item.detected).sort((a, b) => b.confidence - a.confidence)[0]
    if (bestText) {
      return {
        provider: bestText.provider,
        confidence: bestText.confidence,
        region: scaleDetectionRegion(
          bestText.region,
          actualSourceWidth / canvas.width,
          actualSourceHeight / canvas.height,
        ),
      }
    }

    const { removeWatermarkFromImage } = await import("@pilio/gemini-watermark-remover/browser")
    throwIfVisibleMarkAborted(options.signal)
    const result = await removeWatermarkFromImage(canvas, { adaptiveMode: "auto" })
    throwIfVisibleMarkAborted(options.signal)
    const meta = result.meta as GeminiDetectionMeta | null
    if (!isConservativeGeminiDetection(meta, canvas.width, canvas.height)) return null
    return {
      provider: "gemini",
      confidence: geminiDetectionConfidence(meta),
      region: null,
    }
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw visibleMarkAbortError()
    }
    throw error
  } finally {
    bitmap?.close()
  }
}

function boundaryScore(data: Uint8ClampedArray, imageWidth: number, imageHeight: number, target: PixelRect, source: PixelRect) {
  let score = 0
  let samples = 0
  const compare = (tx: number, ty: number, sx: number, sy: number) => {
    if (tx < 0 || ty < 0 || sx < 0 || sy < 0 || tx >= imageWidth || sx >= imageWidth || ty >= imageHeight || sy >= imageHeight) return
    const ti = (ty * imageWidth + tx) * 4
    const si = (sy * imageWidth + sx) * 4
    for (let channel = 0; channel < 3; channel += 1) score += Math.abs(data[ti + channel] - data[si + channel])
    samples += 3
  }
  const step = Math.max(1, Math.floor(Math.min(target.width, target.height) / 24))
  for (let x = 0; x < target.width; x += step) compare(target.x + x, target.y - 1, source.x + x, source.y,)
  for (let y = 0; y < target.height; y += step) compare(target.x - 1, target.y + y, source.x, source.y + y)
  return samples ? score / samples : Number.POSITIVE_INFINITY
}

export function findBestCloneSource(image: ImageData, targetInput: PixelRect): PixelRect | null {
  const target = clampRect(targetInput, image.width, image.height)
  const gap = Math.max(3, Math.round(Math.min(target.width, target.height) * 0.08))
  const candidates: PixelRect[] = []
  for (const multiplier of [1, 1.5, 2, 2.5]) {
    candidates.push({ ...target, y: Math.round(target.y - (target.height + gap) * multiplier) })
    candidates.push({ ...target, x: Math.round(target.x - (target.width + gap) * multiplier) })
  }
  const valid = candidates.filter((rect) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= image.width && rect.y + rect.height <= image.height)
  if (!valid.length) return null
  return valid.reduce((best, candidate) => boundaryScore(image.data, image.width, image.height, target, candidate) < boundaryScore(image.data, image.width, image.height, target, best) ? candidate : best)
}

export function cloneFillRegion(canvas: HTMLCanvasElement, regionInput: PixelRect) {
  const region = clampRect(regionInput, canvas.width, canvas.height)
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("canvas-context-unavailable")
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const source = findBestCloneSource(image, region)
  if (!source) throw new Error("selection-too-large")
  const snapshot = document.createElement("canvas")
  snapshot.width = canvas.width
  snapshot.height = canvas.height
  snapshot.getContext("2d")?.putImageData(image, 0, 0)
  context.save()
  context.beginPath()
  context.rect(region.x, region.y, region.width, region.height)
  context.clip()
  context.drawImage(snapshot, source.x, source.y, source.width, source.height, region.x, region.y, region.width, region.height)
  context.restore()
  return { region, source }
}
