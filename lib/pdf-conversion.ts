export type PdfTargetPageSize = "original" | "a4" | "letter"
export type PdfTargetOrientation = "auto" | "portrait" | "landscape"
export type PdfImageFit = "contain" | "cover"

export const PDF_IMAGE_MAX_FILES = 60
export const PDF_IMAGE_MAX_TOTAL_BYTES = 250 * 1024 * 1024
export const PDF_IMAGE_MAX_PIXELS = 40_000_000
export const PDF_RASTER_MAX_PAGES = 200

const targetSizes = {
  a4: [595.28, 841.89],
  letter: [612, 792],
} as const

export function parsePdfPageSpec(spec: string, total: number) {
  const values = new Set<number>()
  for (const token of spec.split(",").map((item) => item.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:-(\d+))?$/)
    if (!match) continue
    const rawStart = Number(match[1])
    const rawEnd = Number(match[2] ?? match[1])
    if (rawStart > total || rawEnd < 1) continue
    const start = Math.max(1, rawStart)
    const end = Math.min(total, rawEnd)
    for (let page = Math.min(start, end); page <= Math.max(start, end); page++) {
      if (page <= total) values.add(page - 1)
    }
  }
  return [...values]
}

export function resolvePdfPageSize(
  imageWidth: number,
  imageHeight: number,
  target: PdfTargetPageSize,
  orientation: PdfTargetOrientation,
) {
  let width: number
  let height: number
  if (target === "original") {
    // CSS pixels are defined as 1/96 inch, while PDF points are 1/72 inch.
    width = Math.max(1, imageWidth * 0.75)
    height = Math.max(1, imageHeight * 0.75)
  } else {
    ;[width, height] = targetSizes[target]
  }

  const useLandscape = orientation === "landscape"
    || (orientation === "auto" && imageWidth > imageHeight)
  const usePortrait = orientation === "portrait"
    || (orientation === "auto" && imageWidth <= imageHeight)
  if ((useLandscape && width < height) || (usePortrait && width > height)) {
    ;[width, height] = [height, width]
  }
  return { width, height }
}

export function layoutPdfImage(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  margin: number,
  fit: PdfImageFit,
) {
  const safeMargin = Math.max(0, Math.min(margin, Math.min(pageWidth, pageHeight) / 3))
  const availableWidth = Math.max(1, pageWidth - safeMargin * 2)
  const availableHeight = Math.max(1, pageHeight - safeMargin * 2)
  const scale = fit === "cover"
    ? Math.max(availableWidth / imageWidth, availableHeight / imageHeight)
    : Math.min(availableWidth / imageWidth, availableHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  }
}

export function sanitizePdfFileName(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 120)
  const base = cleaned || fallback
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`
}
