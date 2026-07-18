export type WobbleMotion = "sway" | "hop" | "orbit"
export type WobblePresetId = "soft" | "bouncy" | "stretchy" | "spring" | "tremble" | "floating"

export type WobbleSettings = {
  auto: boolean
  motion: WobbleMotion
  strength: number
  speed: number
  stretch: number
  bounce: number
  damping: number
}

export type WobblePreset = {
  id: WobblePresetId
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  settings: WobbleSettings
}

export const defaultWobbleSettings: WobbleSettings = {
  auto: true,
  motion: "sway",
  strength: 42,
  speed: 1,
  stretch: 48,
  bounce: 58,
  damping: 52,
}

export const wobblePresets: WobblePreset[] = [
  {
    id: "soft",
    name: { zh: "柔软晃动", en: "Soft wobble" },
    description: { zh: "轻柔、自然，适合头发和衣角", en: "Gentle motion for hair and clothing" },
    settings: defaultWobbleSettings,
  },
  {
    id: "bouncy",
    name: { zh: "活力弹跳", en: "Bouncy" },
    description: { zh: "回弹明显，适合贴纸和表情", en: "Strong rebound for stickers and emoji" },
    settings: { auto: true, motion: "hop", strength: 58, speed: 1.25, stretch: 32, bounce: 82, damping: 34 },
  },
  {
    id: "stretchy",
    name: { zh: "长长伸展", en: "Stretchy" },
    description: { zh: "拉伸幅度更大，恢复更慢", en: "Longer stretch with a slower return" },
    settings: { auto: true, motion: "sway", strength: 64, speed: .72, stretch: 86, bounce: 44, damping: 30 },
  },
  {
    id: "spring",
    name: { zh: "弹簧跳跳", en: "Spring" },
    description: { zh: "连续弹动，节奏更鲜明", en: "Rhythmic motion with a springy feel" },
    settings: { auto: true, motion: "hop", strength: 50, speed: 1.5, stretch: 44, bounce: 92, damping: 28 },
  },
  {
    id: "tremble",
    name: { zh: "快速颤动", en: "Tremble" },
    description: { zh: "小幅快速，适合强调反应", en: "Small, fast motion for reactions" },
    settings: { auto: true, motion: "sway", strength: 25, speed: 2.4, stretch: 22, bounce: 52, damping: 68 },
  },
  {
    id: "floating",
    name: { zh: "无重力漂浮", en: "Floating" },
    description: { zh: "缓慢绕圈，适合氛围动画", en: "Slow orbital motion for ambient loops" },
    settings: { auto: true, motion: "orbit", strength: 38, speed: .55, stretch: 68, bounce: 30, damping: 72 },
  },
]

export function clampWobbleValue(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function normalizeWobbleSettings(settings: WobbleSettings): WobbleSettings {
  return {
    ...settings,
    strength: clampWobbleValue(settings.strength),
    speed: clampWobbleValue(settings.speed, .2, 3),
    stretch: clampWobbleValue(settings.stretch),
    bounce: clampWobbleValue(settings.bounce),
    damping: clampWobbleValue(settings.damping),
  }
}

export function fitWobbleDimensions(width: number, height: number, maxLongSide: number) {
  if (![width, height, maxLongSide].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Image dimensions and maximum side must be positive")
  }
  const scale = Math.min(1, maxLongSide / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

export function wobbleVector(timeSeconds: number, settingsInput: WobbleSettings, manual = { x: 0, y: 0 }) {
  const settings = normalizeWobbleSettings(settingsInput)
  const manualMagnitude = Math.hypot(manual.x, manual.y)
  if (manualMagnitude > .015) {
    const limit = Math.max(1, manualMagnitude)
    return { x: manual.x / limit, y: manual.y / limit }
  }
  if (!settings.auto) return { x: 0, y: 0 }
  const phase = timeSeconds * Math.PI * 2 * settings.speed
  if (settings.motion === "hop") {
    return { x: Math.sin(phase * .5) * .14, y: -Math.abs(Math.sin(phase)) }
  }
  if (settings.motion === "orbit") {
    return { x: Math.cos(phase), y: Math.sin(phase) * .72 }
  }
  return { x: Math.sin(phase), y: Math.sin(phase * 2 + .8) * .22 }
}

export function wobbleOutputName(sourceName: string, format: "gif" | "webm" | "mp4") {
  const base = sourceName.replace(/\.[^.]+$/, "").trim() || "image"
  return `${base}-wobble.${format}`
}

export function preferredVideoMime(format: "webm" | "mp4", supported: (mime: string) => boolean) {
  const candidates = format === "mp4"
    ? ["video/mp4;codecs=avc1.42E01E", "video/mp4"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  return candidates.find(supported) ?? ""
}
