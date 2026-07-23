export const BACKGROUND_PRESET_IDS = [
  "white-studio",
  "warm-studio",
  "cool-studio",
  "pastel-glow",
  "soft-office",
  "warm-cafe",
  "green-nature",
  "city-dusk",
] as const

export type BackgroundPresetId = typeof BACKGROUND_PRESET_IDS[number]
export type BackgroundFillMode = "transparent" | "color" | "gradient" | "preset" | "image" | "blur-original"
export type BackgroundCanvasPreset = "original" | "square" | "portrait" | "story" | "marketplace" | "custom"
export type BackgroundOutputType = "image/png" | "image/jpeg" | "image/webp"

export const BACKGROUND_PRESETS: ReadonlyArray<{
  id: BackgroundPresetId
  preview: string
}> = [
  { id: "white-studio", preview: "linear-gradient(180deg,#fff 0%,#f8fafc 58%,#e5e7eb 59%,#f8fafc 100%)" },
  { id: "warm-studio", preview: "radial-gradient(circle at 50% 20%,#fffaf4 0 22%,transparent 58%),linear-gradient(180deg,#f8ead9 0%,#ead2b8 62%,#d8b996 100%)" },
  { id: "cool-studio", preview: "radial-gradient(circle at 20% 15%,#fff 0 8%,transparent 38%),linear-gradient(145deg,#edf5fa 0%,#cbd9e5 58%,#a9bac8 100%)" },
  { id: "pastel-glow", preview: "radial-gradient(circle at 18% 22%,#fbcfe8 0 12%,transparent 35%),radial-gradient(circle at 80% 24%,#bfdbfe 0 14%,transparent 38%),radial-gradient(circle at 60% 88%,#ddd6fe 0 18%,transparent 42%),linear-gradient(145deg,#fff7ed,#f5f3ff)" },
  { id: "soft-office", preview: "linear-gradient(90deg,transparent 0 14%,#dff4ff 14% 33%,transparent 33% 40%,#dff4ff 40% 61%,transparent 61%),linear-gradient(180deg,#eff6f8 0 63%,#a9947f 64% 69%,#d6c6b3 70%)" },
  { id: "warm-cafe", preview: "radial-gradient(circle at 20% 30%,#fde68a 0 4%,transparent 13%),radial-gradient(circle at 78% 25%,#fdba74 0 5%,transparent 16%),linear-gradient(180deg,#5b4035 0 62%,#a36f4f 63% 70%,#d9b38c 71%)" },
  { id: "green-nature", preview: "radial-gradient(circle at 18% 18%,#ecfccb 0 6%,transparent 20%),radial-gradient(circle at 78% 28%,#bbf7d0 0 9%,transparent 24%),linear-gradient(180deg,#dff5ef 0 38%,#9ac8a7 39% 64%,#5c8d68 65%)" },
  { id: "city-dusk", preview: "radial-gradient(circle at 75% 18%,#fff7c2 0 4%,transparent 13%),linear-gradient(180deg,#b8c4ed 0%,#e8b8c9 52%,#625c7b 53% 64%,#27293d 65%)" },
]

export type BackgroundFinishSettings = {
  fillMode: BackgroundFillMode
  presetId: BackgroundPresetId
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
  presetId: "white-studio",
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

function isBackgroundPresetId(value: unknown): value is BackgroundPresetId {
  return BACKGROUND_PRESET_IDS.includes(value as BackgroundPresetId)
}

export function normalizeBackgroundFinishSettings(input?: Partial<BackgroundFinishSettings>): BackgroundFinishSettings {
  const merged = { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, ...input }
  const outputType = merged.outputType === "image/jpeg" || merged.outputType === "image/webp" ? merged.outputType : "image/png"
  return {
    ...merged,
    presetId: isBackgroundPresetId(merged.presetId) ? merged.presetId : DEFAULT_BACKGROUND_FINISH_SETTINGS.presetId,
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

function fillVerticalGradient(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: Array<[number, string]>,
) {
  const gradient = context.createLinearGradient(0, 0, 0, height)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

function drawSoftCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

export function drawBackgroundPreset(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  presetId: BackgroundPresetId,
) {
  const short = Math.min(width, height)
  context.save()

  if (presetId === "white-studio") {
    fillVerticalGradient(context, width, height, [[0, "#ffffff"], [0.62, "#f8fafc"], [0.625, "#e5e7eb"], [1, "#f8fafc"]])
    drawSoftCircle(context, width * 0.5, height * 0.82, short * 0.36, "rgba(148,163,184,.18)")
  } else if (presetId === "warm-studio") {
    fillVerticalGradient(context, width, height, [[0, "#fffaf4"], [0.58, "#f2dfc9"], [1, "#d8b996"]])
    drawSoftCircle(context, width * 0.5, height * 0.18, short * 0.55, "rgba(255,255,255,.72)")
    drawSoftCircle(context, width * 0.5, height * 0.82, short * 0.38, "rgba(136,94,55,.15)")
  } else if (presetId === "cool-studio") {
    fillVerticalGradient(context, width, height, [[0, "#f8fbfd"], [0.56, "#dbe7ef"], [1, "#aebfcd"]])
    drawSoftCircle(context, width * 0.2, height * 0.12, short * 0.52, "rgba(255,255,255,.78)")
    drawSoftCircle(context, width * 0.78, height * 0.74, short * 0.42, "rgba(80,120,150,.15)")
  } else if (presetId === "pastel-glow") {
    fillVerticalGradient(context, width, height, [[0, "#fff7ed"], [1, "#f5f3ff"]])
    drawSoftCircle(context, width * 0.16, height * 0.18, short * 0.42, "rgba(244,114,182,.38)")
    drawSoftCircle(context, width * 0.82, height * 0.22, short * 0.48, "rgba(96,165,250,.36)")
    drawSoftCircle(context, width * 0.62, height * 0.88, short * 0.52, "rgba(167,139,250,.38)")
  } else if (presetId === "soft-office") {
    fillVerticalGradient(context, width, height, [[0, "#eff6f8"], [0.64, "#d8e5e8"], [0.645, "#a9947f"], [0.7, "#c7af98"], [1, "#dfd3c5"]])
    context.fillStyle = "rgba(219,244,255,.9)"
    const paneWidth = width * 0.19
    for (const x of [width * 0.08, width * 0.39, width * 0.7]) {
      context.fillRect(x, height * 0.09, paneWidth, height * 0.42)
    }
    drawSoftCircle(context, width * 0.18, height * 0.28, short * 0.22, "rgba(255,255,255,.52)")
    drawSoftCircle(context, width * 0.82, height * 0.38, short * 0.2, "rgba(107,156,123,.28)")
  } else if (presetId === "warm-cafe") {
    fillVerticalGradient(context, width, height, [[0, "#4a342e"], [0.62, "#6f4d3e"], [0.625, "#9b6a4b"], [0.71, "#c3946e"], [1, "#dfc0a1"]])
    drawSoftCircle(context, width * 0.18, height * 0.24, short * 0.25, "rgba(253,224,71,.72)")
    drawSoftCircle(context, width * 0.78, height * 0.2, short * 0.3, "rgba(251,146,60,.64)")
    drawSoftCircle(context, width * 0.48, height * 0.08, short * 0.2, "rgba(255,247,205,.38)")
  } else if (presetId === "green-nature") {
    fillVerticalGradient(context, width, height, [[0, "#e5f6f2"], [0.4, "#b7d9c1"], [0.64, "#79aa84"], [1, "#456e50"]])
    drawSoftCircle(context, width * 0.16, height * 0.18, short * 0.3, "rgba(236,252,203,.66)")
    drawSoftCircle(context, width * 0.82, height * 0.28, short * 0.38, "rgba(134,239,172,.42)")
    drawSoftCircle(context, width * 0.46, height * 0.72, short * 0.34, "rgba(34,110,61,.25)")
  } else {
    fillVerticalGradient(context, width, height, [[0, "#afbde8"], [0.5, "#e8b7c9"], [0.64, "#6c6685"], [1, "#292a3e"]])
    drawSoftCircle(context, width * 0.76, height * 0.16, short * 0.22, "rgba(255,244,176,.62)")
    context.fillStyle = "rgba(31,34,55,.72)"
    const skyline = [
      [0, .68, .13, .32], [.11, .58, .16, .42], [.25, .72, .12, .28], [.35, .52, .18, .48],
      [.52, .65, .13, .35], [.63, .56, .2, .44], [.81, .7, .19, .3],
    ]
    for (const [x, y, blockWidth, blockHeight] of skyline) {
      context.fillRect(width * x, height * y, width * blockWidth, height * blockHeight)
    }
    for (const [x, y] of [[.17, .69], [.43, .63], [.72, .66], [.88, .78]]) {
      drawSoftCircle(context, width * x, height * y, short * .035, "rgba(255,220,130,.85)")
    }
  }

  context.restore()
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
  } else if (settings.fillMode === "preset") {
    drawBackgroundPreset(context, width, height, settings.presetId)
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
