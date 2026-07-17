export type TransformOptions = {
  format: "image/jpeg" | "image/png" | "image/webp"
  quality: number
  maxEdge?: number
  width?: number
  height?: number
  aspect?: "original" | "1:1" | "4:3" | "16:9"
  rotation?: 0 | 90 | 180 | 270
  flipX?: boolean
  flipY?: boolean
  brightness?: number
  contrast?: number
  saturation?: number
  grayscale?: boolean
  watermarkText?: string
  watermarkImage?: { pixels: Uint8ClampedArray; width: number; height: number }
  targetBytes?: number
}

export type TransformResult = {
  blob: Blob
  width: number
  height: number
  quality: number
  targetReached: boolean
}

type DrawableCanvas = OffscreenCanvas | HTMLCanvasElement
type DrawableSource = ImageBitmap | OffscreenCanvas

function makeCanvas(width: number, height: number): DrawableCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

async function canvasToBlob(canvas: DrawableCanvas, type: string, quality: number) {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type, quality })
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片编码失败")), type, quality))
}

function aspectValue(aspect: TransformOptions["aspect"], width: number, height: number) {
  if (!aspect || aspect === "original") return width / height
  const [x, y] = aspect.split(":").map(Number)
  return x / y
}

export function sourceCrop(width: number, height: number, targetAspect: number) {
  const sourceAspect = width / height
  if (Math.abs(sourceAspect - targetAspect) < 0.001) return { sx: 0, sy: 0, sw: width, sh: height }
  if (sourceAspect > targetAspect) {
    const sw = Math.round(height * targetAspect)
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height }
  }
  const sh = Math.round(width / targetAspect)
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh }
}

export function outputSize(sourceWidth: number, sourceHeight: number, options: TransformOptions, scale = 1) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("图片解码后的尺寸无效")
  }
  const targetAspect = aspectValue(options.aspect, sourceWidth, sourceHeight)
  let width = options.width || (options.height ? Math.round(options.height * targetAspect) : sourceWidth)
  let height = options.height || (options.width ? Math.round(options.width / targetAspect) : Math.round(width / targetAspect))
  if (options.maxEdge && Math.max(width, height) > options.maxEdge) {
    const ratio = options.maxEdge / Math.max(width, height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))
  return { width, height }
}

async function render(source: DrawableSource, sourceWidth: number, sourceHeight: number, options: TransformOptions, scale: number, quality: number) {
  const size = outputSize(sourceWidth, sourceHeight, options, scale)
  const rotated = options.rotation === 90 || options.rotation === 270
  const canvas = makeCanvas(rotated ? size.height : size.width, rotated ? size.width : size.height)
  const context = canvas.getContext("2d", { alpha: options.format !== "image/jpeg" }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (!context) throw new Error("浏览器无法创建 Canvas")
  if (options.format === "image/jpeg") {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.save()
  if (options.rotation === 90) { context.translate(canvas.width, 0); context.rotate(Math.PI / 2) }
  if (options.rotation === 180) { context.translate(canvas.width, canvas.height); context.rotate(Math.PI) }
  if (options.rotation === 270) { context.translate(0, canvas.height); context.rotate(-Math.PI / 2) }
  const crop = sourceCrop(sourceWidth, sourceHeight, aspectValue(options.aspect, sourceWidth, sourceHeight))
  context.filter = `brightness(${options.brightness ?? 100}%) contrast(${options.contrast ?? 100}%) saturate(${options.saturation ?? 100}%) grayscale(${options.grayscale ? 100 : 0}%)`
  if (options.flipX || options.flipY) {
    context.translate(options.flipX ? size.width : 0, options.flipY ? size.height : 0)
    context.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1)
  }
  context.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.width, size.height)
  context.restore()
  if (options.watermarkText?.trim()) {
    const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * .045))
    context.font = `600 ${fontSize}px sans-serif`
    context.textAlign = "right"
    context.textBaseline = "bottom"
    const padding = Math.max(12, Math.round(fontSize * .7))
    context.lineWidth = Math.max(2, fontSize / 12)
    context.strokeStyle = "rgba(0,0,0,.55)"
    context.fillStyle = "rgba(255,255,255,.86)"
    context.strokeText(options.watermarkText.trim(), canvas.width - padding, canvas.height - padding)
    context.fillText(options.watermarkText.trim(), canvas.width - padding, canvas.height - padding)
  }
  if (options.watermarkImage?.width && options.watermarkImage.height) {
    const mark = makeCanvas(options.watermarkImage.width, options.watermarkImage.height)
    const markContext = mark.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
    if (markContext) {
      markContext.putImageData(new ImageData(Uint8ClampedArray.from(options.watermarkImage.pixels), options.watermarkImage.width, options.watermarkImage.height), 0, 0)
      const maxWidth = canvas.width * .24
      const maxHeight = canvas.height * .18
      const ratio = Math.min(1, maxWidth / options.watermarkImage.width, maxHeight / options.watermarkImage.height)
      const markWidth = Math.max(1, Math.round(options.watermarkImage.width * ratio))
      const markHeight = Math.max(1, Math.round(options.watermarkImage.height * ratio))
      const padding = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * .025))
      context.save()
      context.globalAlpha = .86
      context.drawImage(mark, canvas.width - markWidth - padding, padding, markWidth, markHeight)
      context.restore()
    }
  }
  const blob = await canvasToBlob(canvas, options.format, quality)
  return { blob, width: canvas.width, height: canvas.height }
}

export async function searchTargetSize(
  renderCandidate: (scale: number, quality: number) => Promise<{ blob: Blob; width: number; height: number }>,
  targetBytes: number,
  initialQuality: number,
): Promise<TransformResult> {
  let best: Awaited<ReturnType<typeof renderCandidate>> | null = null
  let bestQuality = initialQuality
  let scale = 1
  for (let scalePass = 0; scalePass < 5; scalePass++) {
    let low = 0.12
    let high = Math.min(0.98, initialQuality)
    for (let index = 0; index < 8; index++) {
      const quality = (low + high) / 2
      const candidate = await renderCandidate(scale, quality)
      if (candidate.blob.size <= targetBytes) {
        best = candidate
        bestQuality = quality
        low = quality
      } else high = quality
    }
    if (best) break
    scale *= 0.84
  }
  if (!best) {
    bestQuality = 0.12
    best = await renderCandidate(scale, bestQuality)
  }
  return { ...best, quality: bestQuality, targetReached: best.blob.size <= targetBytes }
}

async function transformSource(source: DrawableSource, sourceWidth: number, sourceHeight: number, options: TransformOptions): Promise<TransformResult> {
  if (!sourceWidth || !sourceHeight) throw new Error("图片解码后的尺寸无效")
  if (!options.targetBytes || options.format === "image/png") {
    const rendered = await render(source, sourceWidth, sourceHeight, options, 1, options.quality)
    return { ...rendered, quality: options.quality, targetReached: !options.targetBytes || rendered.blob.size <= options.targetBytes }
  }

  return searchTargetSize(
    (scale, quality) => render(source, sourceWidth, sourceHeight, options, scale, quality),
    options.targetBytes,
    options.quality,
  )
}

async function transformImageBitmap(bitmap: ImageBitmap, options: TransformOptions): Promise<TransformResult> {
  try {
    return await transformSource(bitmap, bitmap.width, bitmap.height, options)
  } finally {
    bitmap.close()
  }
}

export function transformCanvas(canvas: OffscreenCanvas, options: TransformOptions): Promise<TransformResult> {
  return transformSource(canvas, canvas.width, canvas.height, options)
}

export async function transformImage(file: Blob, options: TransformOptions): Promise<TransformResult> {
  return transformImageBitmap(await createImageBitmap(file, { imageOrientation: "from-image" }), options)
}
