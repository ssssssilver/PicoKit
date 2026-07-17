export const GENERAL_BACKGROUND_MODEL = {
  id: "Heliosoph/u2net-onnx",
  revision: "7fc34deee10329bc039c10a73b98090d0c6f5c59",
  weightFile: "u2netp.onnx",
  sha256: "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8",
  estimatedDownloadBytes: 4_574_861,
  inputSize: 320,
} as const

export function backgroundModelCacheUrl() {
  return `https://huggingface.co/${GENERAL_BACKGROUND_MODEL.id}/resolve/${GENERAL_BACKGROUND_MODEL.revision}/${GENERAL_BACKGROUND_MODEL.weightFile}`
}

export function normalizeSaliencyMask(values: ArrayLike<number>) {
  const result = new Uint8ClampedArray(values.length)
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index])
    if (!Number.isFinite(value)) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  const range = max - min
  if (!Number.isFinite(range) || range <= 1e-8) return result
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index])
    result[index] = Number.isFinite(value) ? Math.round((value - min) / range * 255) : 0
  }
  return result
}

// Refinement keeps decoded source, result, and mask surfaces alive together.
// A lower limit than inference prevents large images from exhausting the tab
// after background removal has already completed successfully.
export const BACKGROUND_REFINEMENT_MAX_PIXELS = 12_000_000

export function canRefineBackground(width: number, height: number) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width * height <= BACKGROUND_REFINEMENT_MAX_PIXELS
}

export function sourceBrushSize(previewBrushSize: number, sourceWidth: number, previewWidth: number) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(previewWidth) || sourceWidth <= 0 || previewWidth <= 0) return 1
  const safePreviewSize = Math.max(4, Math.min(160, Number(previewBrushSize) || 4))
  return Math.max(1, safePreviewSize * sourceWidth / previewWidth)
}

export function backgroundRefinementShortcut(input: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}): "undo" | "reset" | null {
  const key = input.key.toLowerCase()
  if ((input.ctrlKey || input.metaKey) && !input.altKey && !input.shiftKey && key === "z") return "undo"
  if (!input.ctrlKey && !input.metaKey && !input.altKey && !input.shiftKey && key === "r") return "reset"
  return null
}

export function backgroundRemovalOutputName(fileName: string) {
  const stem = fileName.trim().replace(/\.[^.]+$/, "") || "image"
  return `${stem}-removebg-tabnative.png`
}
