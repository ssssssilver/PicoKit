export const IMAGE_EDITOR_MAX_BYTES = 25 * 1024 * 1024
export const IMAGE_EDITOR_MAX_PIXELS = 24_000_000
export const IMAGE_EDITOR_PREVIEW_MAX_EDGE = 2048
export const IMAGE_EDITOR_HISTORY_LIMIT = 30

export type EditorExportFormat = "image/jpeg" | "image/png" | "image/webp"

export type EditorCropBounds = {
  left: number
  top: number
  width: number
  height: number
}

export function getEditorPreviewSize(width: number, height: number, maxEdge = IMAGE_EDITOR_PREVIEW_MAX_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid image dimensions")
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    sourceScale: 1 / scale,
  }
}

export function clampEditorCrop(bounds: EditorCropBounds, canvasWidth: number, canvasHeight: number): EditorCropBounds {
  const left = Math.max(0, Math.min(canvasWidth - 1, Math.round(bounds.left)))
  const top = Math.max(0, Math.min(canvasHeight - 1, Math.round(bounds.top)))
  const width = Math.max(1, Math.min(canvasWidth - left, Math.round(bounds.width)))
  const height = Math.max(1, Math.min(canvasHeight - top, Math.round(bounds.height)))
  return { left, top, width, height }
}

export function editorOutputDimensions(width: number, height: number, sourceScale: number) {
  return {
    width: Math.max(1, Math.round(width * sourceScale)),
    height: Math.max(1, Math.round(height * sourceScale)),
  }
}

export function editorOutputName(filename: string, format: EditorExportFormat) {
  const base = filename.replace(/\.[^.]+$/, "") || "image"
  const extension = format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png"
  return `${base}-edited.${extension}`
}

