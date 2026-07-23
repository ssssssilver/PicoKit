export type BackgroundFillMode = "transparent" | "color" | "gradient" | "image" | "blur-original"
export type BackgroundCanvasPreset = "original" | "square" | "portrait" | "story" | "marketplace" | "custom"
export type BackgroundOutputType = "image/png" | "image/jpeg" | "image/webp"

export type BackgroundFinishSettings = {
  fillMode: BackgroundFillMode
  color: string
  gradientStart: string
  gradientEnd: string
  gradientAngle: number
  backgroundImage?: File
  canvasPreset: BackgroundCanvasPreset
  customWidth: number
  customHeight: number
  subjectScale: number
  subjectX: number
  subjectY: number
  shadowEnabled: boolean
  shadowColor: string
  shadowOpacity: number
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  outputType: BackgroundOutputType
  quality: number
}

export type BackgroundFinishOutput = {
  blob: Blob
  width: number
  height: number
  settings: BackgroundFinishSettings
}

export const DEFAULT_BACKGROUND_FINISH_SETTINGS: BackgroundFinishSettings = {
  fillMode: "transparent",
  color: "#ffffff",
  gradientStart: "#dbeafe",
  gradientEnd: "#ede9fe",
  gradientAngle: 135,
  canvasPreset: "original",
  customWidth: 1080,
  customHeight: 1080,
  subjectScale: 90,
  subjectX: 0,
  subjectY: 0,
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowOpacity: 28,
  shadowBlur: 28,
  shadowOffsetX: 0,
  shadowOffsetY: 18,
  outputType: "image/png",
  quality: 92,
}

export const BACKGROUND_FINISH_MAX_PIXELS = 16_000_000
export const BACKGROUND_FINISH_MAX_SIDE = 4096

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

export function normalizeBackgroundFinishSettings(input?: Partial<BackgroundFinishSettings>): BackgroundFinishSettings {
  const merged = { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, ...input }
  const outputType = merged.outputType === "image/jpeg" || merged.outputType === "image/webp" ? merged.outputType : "image/png"
  return {
    ...merged,
    color: safeColor(merged.color, DEFAULT_BACKGROUND_FINISH_SETTINGS.color),
    gradientStart: safeColor(merged.gradientStart, DEFAULT_BACKGROUND_FINISH_SETTINGS.gradientStart),
    gradientEnd: safeColor(merged.gradientEnd, DEFAULT_BACKGROUND_FINISH_SETTINGS.gradientEnd),
    gradientAngle: clamp(merged.gradientAngle, 0, 360),
    customWidth: Math.round(clamp(merged.customWidth, 64, BACKGROUND_FINISH_MAX_SIDE)),
    customHeight: Math.round(clamp(merged.customHeight, 64, BACKGROUND_FINISH_MAX_SIDE)),
    subjectScale: clamp(merged.subjectScale, 40, 140),
    subjectX: clamp(merged.subjectX, -50, 50),
    subjectY: clamp(merged.subjectY, -50, 50),
    shadowColor: safeColor(merged.shadowColor, DEFAULT_BACKGROUND_FINISH_SETTINGS.shadowColor),
    shadowOpacity: clamp(merged.shadowOpacity, 0, 100),
    shadowBlur: clamp(merged.shadowBlur, 0, 80),
    shadowOffsetX: clamp(merged.shadowOffsetX, -80, 80),
    shadowOffsetY: clamp(merged.shadowOffsetY, -80, 80),
    outputType,
    quality: clamp(merged.quality, 40, 100),
  }
}

export function backgroundFinishCanvasSize(
  sourceWidth: number,
  sourceHeight: number,
  settings: Pick<BackgroundFinishSettings, "canvasPreset" | "customWidth" | "customHeight">,
) {
  const width = Math.max(1, Math.round(sourceWidth))
  const height = Math.max(1, Math.round(sourceHeight))
  let target = { width, height }
  if (settings.canvasPreset === "square") target = { width: 1080, height: 1080 }
  if (settings.canvasPreset === "portrait") target = { width: 1080, height: 1350 }
  if (settings.canvasPreset === "story") target = { width: 1080, height: 1920 }
  if (settings.canvasPreset === "marketplace") target = { width: 2000, height: 2000 }
  if (settings.canvasPreset === "custom") target = {
    width: Math.round(clamp(settings.customWidth, 64, BACKGROUND_FINISH_MAX_SIDE)),
    height: Math.round(clamp(settings.customHeight, 64, BACKGROUND_FINISH_MAX_SIDE)),
  }
  if (target.width * target.height <= BACKGROUND_FINISH_MAX_PIXELS) return target
  const scale = Math.sqrt(BACKGROUND_FINISH_MAX_PIXELS / (target.width * target.height))
  return {
    width: Math.max(1, Math.floor(target.width * scale)),
    height: Math.max(1, Math.floor(target.height * scale)),
  }
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
  overscan = 1,
) {
  const scale = Math.max(width / image.width, height / image.height) * overscan
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function gradientEndpoints(width: number, height: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180
  const x = Math.cos(radians)
  const y = Math.sin(radians)
  const radius = Math.abs(width * x) + Math.abs(height * y)
  return {
    x0: width / 2 - x * radius / 2,
    y0: height / 2 - y * radius / 2,
    x1: width / 2 + x * radius / 2,
    y1: height / 2 + y * radius / 2,
  }
}

function colorWithAlpha(color: string, opacity: number) {
  const value = Number.parseInt(color.slice(1), 16)
  const red = value >> 16 & 255
  const green = value >> 8 & 255
  const blue = value & 255
  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 100) / 100})`
}

export function drawBackgroundFinish(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: CanvasImageSource & { width: number; height: number },
  cutout: CanvasImageSource & { width: number; height: number },
  settingsInput: BackgroundFinishSettings,
  backgroundImage?: CanvasImageSource & { width: number; height: number },
) {
  const settings = normalizeBackgroundFinishSettings(settingsInput)
  context.save()
  context.clearRect(0, 0, width, height)
  context.globalCompositeOperation = "source-over"
  context.filter = "none"

  if (settings.fillMode === "transparent" && settings.outputType === "image/jpeg") {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
  } else if (settings.fillMode === "color") {
    context.fillStyle = settings.color
    context.fillRect(0, 0, width, height)
  } else if (settings.fillMode === "gradient") {
    const points = gradientEndpoints(width, height, settings.gradientAngle)
    const gradient = context.createLinearGradient(points.x0, points.y0, points.x1, points.y1)
    gradient.addColorStop(0, settings.gradientStart)
    gradient.addColorStop(1, settings.gradientEnd)
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  } else if (settings.fillMode === "image" && backgroundImage) {
    drawCover(context, backgroundImage, width, height)
  } else if (settings.fillMode === "blur-original") {
    const blur = Math.max(6, Math.round(Math.min(width, height) * 0.025))
    context.filter = `blur(${blur}px)`
    drawCover(context, source, width, height, 1.08)
    context.filter = "none"
  }

  const fitScale = Math.min(width / cutout.width, height / cutout.height) * 0.9
  const scale = fitScale * settings.subjectScale / 100
  const drawWidth = cutout.width * scale
  const drawHeight = cutout.height * scale
  const travelX = Math.max(width, drawWidth) * 0.5
  const travelY = Math.max(height, drawHeight) * 0.5
  const x = (width - drawWidth) / 2 + settings.subjectX / 100 * travelX
  const y = (height - drawHeight) / 2 + settings.subjectY / 100 * travelY

  if (settings.shadowEnabled) {
    const effectScale = Math.min(width, height) / 1000
    context.shadowColor = colorWithAlpha(settings.shadowColor, settings.shadowOpacity)
    context.shadowBlur = settings.shadowBlur * effectScale
    context.shadowOffsetX = settings.shadowOffsetX * effectScale
    context.shadowOffsetY = settings.shadowOffsetY * effectScale
  }
  context.drawImage(cutout, x, y, drawWidth, drawHeight)
  context.restore()
}

export async function composeBackgroundFinish(
  source: Blob,
  cutout: Blob,
  settingsInput: BackgroundFinishSettings,
): Promise<BackgroundFinishOutput> {
  const settings = normalizeBackgroundFinishSettings(settingsInput)
  const sourceBitmap = await createImageBitmap(source)
  const cutoutBitmap = await createImageBitmap(cutout)
  let backgroundBitmap: ImageBitmap | undefined
  try {
    if (settings.fillMode === "image" && settings.backgroundImage) {
      backgroundBitmap = await createImageBitmap(settings.backgroundImage)
    }
    const size = backgroundFinishCanvasSize(cutoutBitmap.width, cutoutBitmap.height, settings)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    drawBackgroundFinish(context, size.width, size.height, sourceBitmap, cutoutBitmap, settings, backgroundBitmap)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("Image encoding failed")),
        settings.outputType,
        settings.outputType === "image/png" ? undefined : settings.quality / 100,
      )
    })
    return { blob, width: size.width, height: size.height, settings }
  } finally {
    sourceBitmap.close()
    cutoutBitmap.close()
    backgroundBitmap?.close()
  }
}

export function backgroundFinishOutputName(fileName: string, outputType: BackgroundOutputType) {
  const stem = fileName.trim().replace(/\.[^.]+$/, "") || "image"
  const extension = outputType === "image/jpeg" ? "jpg" : outputType === "image/webp" ? "webp" : "png"
  return `${stem}-removebg-tabnative.${extension}`
}
