export type CameraNormalizationResult = {
  blob: Blob
  format: "image/jpeg" | "image/png"
  steps: Array<"resample" | "sensor-noise" | "reencode">
}

const RESAMPLE_SCALE = 0.92
const JPEG_QUALITY = 0.9

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

async function loadBitmap(source: Blob) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(source, { imageOrientation: "from-image" })
  }

  const url = URL.createObjectURL(source)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("image-decode-failed"))
      element.src = url
    })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function randomSeed(width: number, height: number) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0] || 0x6d2b79f5
  }
  return ((width * 73856093) ^ (height * 19349663) ^ Date.now()) >>> 0
}

function xorshift32(seed: number) {
  let state = seed >>> 0 || 0x6d2b79f5
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

export function applySubtleSensorNoise(image: ImageData, seed: number) {
  const next = xorshift32(seed)
  const pixels = image.data
  let hasTransparency = false

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3]
    if (alpha < 255) hasTransparency = true
    if (alpha === 0) continue

    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    const luminance = (red * 54 + green * 183 + blue * 19) / 65_280
    const strength = 1.15 + 1.35 * Math.sqrt(luminance)
    const value = next()
    const triangular = ((value & 0xff) + ((value >>> 8) & 0xff) - 255) / 255
    const shared = triangular * strength
    const redChroma = (((value >>> 16) & 0xff) / 255 - 0.5) * 0.7
    const blueChroma = (((value >>> 24) & 0xff) / 255 - 0.5) * 0.7

    pixels[offset] = red + shared + redChroma
    pixels[offset + 1] = green + shared * 0.92
    pixels[offset + 2] = blue + shared + blueChroma
  }

  return hasTransparency
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("result-encode-failed")),
      type,
      quality,
    )
  })
}

/**
 * Applies a restrained, browser-only camera delivery profile: high-quality
 * resize round-trip, signal-dependent sensor grain, then a clean re-encode.
 * It deliberately does not create EXIF or claim a camera origin.
 */
export async function normalizeForImageDelivery(source: Blob): Promise<CameraNormalizationResult> {
  const bitmap = await loadBitmap(source)
  const width = bitmap.width
  const height = bitmap.height
  if (!width || !height) {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close()
    throw new Error("image-decode-failed")
  }

  const reduced = createCanvas(
    Math.max(1, Math.round(width * RESAMPLE_SCALE)),
    Math.max(1, Math.round(height * RESAMPLE_SCALE)),
  )
  const reducedContext = reduced.getContext("2d", { alpha: true })
  const output = createCanvas(width, height)
  const outputContext = output.getContext("2d", { alpha: true, willReadFrequently: true })
  if (!reducedContext || !outputContext) {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close()
    throw new Error("canvas-unavailable")
  }

  reducedContext.imageSmoothingEnabled = true
  reducedContext.imageSmoothingQuality = "high"
  reducedContext.drawImage(bitmap, 0, 0, reduced.width, reduced.height)
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close()

  outputContext.imageSmoothingEnabled = true
  outputContext.imageSmoothingQuality = "high"
  outputContext.drawImage(reduced, 0, 0, width, height)
  const image = outputContext.getImageData(0, 0, width, height)
  const hasTransparency = applySubtleSensorNoise(image, randomSeed(width, height))
  outputContext.putImageData(image, 0, 0)

  const format = hasTransparency ? "image/png" : "image/jpeg"
  const blob = await canvasBlob(output, format, format === "image/jpeg" ? JPEG_QUALITY : undefined)
  return {
    blob,
    format,
    steps: ["resample", "sensor-noise", "reencode"],
  }
}
