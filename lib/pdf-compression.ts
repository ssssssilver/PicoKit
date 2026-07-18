export type PdfCompressionMode = "structure" | "balanced" | "smallest"

export const PDF_RASTER_COMPRESSION_MAX_PAGES = 200

export const PDF_COMPRESSION_PRESETS = {
  structure: { raster: false, dpi: 0, quality: 1 },
  balanced: { raster: true, dpi: 110, quality: 0.78 },
  smallest: { raster: true, dpi: 82, quality: 0.64 },
} as const satisfies Record<PdfCompressionMode, { raster: boolean; dpi: number; quality: number }>

export function pdfCompressionPreset(mode: PdfCompressionMode) {
  return PDF_COMPRESSION_PRESETS[mode]
}

export function canRasterCompressPdf(pageCount: number) {
  return Number.isInteger(pageCount) && pageCount > 0 && pageCount <= PDF_RASTER_COMPRESSION_MAX_PAGES
}
