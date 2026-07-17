import { detectImageType } from "@/lib/file-validation"

export type PdfPagePlanItem = {
  id: string
  sourceIndex: number
  rotation: number
}

export type PdfWatermarkOptions = {
  pngBytes: Uint8Array
  opacity?: number
}

export type PdfOrganizerExportOptions = {
  pageNumbers?: boolean
  pageNumberStart?: number
  watermark?: PdfWatermarkOptions | null
}

export type PdfImageFormat = "jpeg" | "png"

export function detectPdfImageFormat(bytes: Uint8Array): PdfImageFormat | null {
  const detected = detectImageType(bytes)
  if (detected?.mime === "image/jpeg") return "jpeg"
  if (detected?.mime === "image/png") return "png"
  return null
}

export function createPdfPagePlan(totalPages: number): PdfPagePlanItem[] {
  if (!Number.isInteger(totalPages) || totalPages < 0) return []
  return Array.from({ length: totalPages }, (_, sourceIndex) => ({
    id: `page-${sourceIndex + 1}`,
    sourceIndex,
    rotation: 0,
  }))
}

export function movePdfPage(plan: readonly PdfPagePlanItem[], index: number, offset: -1 | 1) {
  const target = index + offset
  if (index < 0 || index >= plan.length || target < 0 || target >= plan.length) return [...plan]
  const next = [...plan]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function rotatePdfPage(plan: readonly PdfPagePlanItem[], index: number, degrees = 90) {
  return plan.map((page, pageIndex) => pageIndex === index
    ? { ...page, rotation: normalizePdfRotation(page.rotation + degrees) }
    : page)
}

export function deletePdfPage(plan: readonly PdfPagePlanItem[], index: number) {
  return plan.filter((_, pageIndex) => pageIndex !== index)
}

export function normalizePdfRotation(rotation: number) {
  return ((Math.round(rotation / 90) * 90) % 360 + 360) % 360
}

export async function organizePdfBytes(
  sourceBytes: ArrayBuffer | Uint8Array,
  plan: readonly PdfPagePlanItem[],
  options: PdfOrganizerExportOptions = {},
) {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import("pdf-lib")
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: false })
  validatePdfPagePlan(plan, source.getPageCount())

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(source, plan.map((page) => page.sourceIndex))
  const pageNumberFont = options.pageNumbers ? await output.embedFont(StandardFonts.Helvetica) : null
  const watermark = options.watermark?.pngBytes?.length
    ? await output.embedPng(options.watermark.pngBytes)
    : null
  const watermarkOpacity = clamp(options.watermark?.opacity ?? 0.18, 0.05, 0.8)
  const pageNumberStart = Number.isFinite(options.pageNumberStart) ? Math.max(1, Math.round(options.pageNumberStart!)) : 1

  copiedPages.forEach((page, index) => {
    const planned = plan[index]
    if (planned.rotation) page.setRotation(degrees(normalizePdfRotation(page.getRotation().angle + planned.rotation)))
    output.addPage(page)

    if (watermark) {
      const maxWidth = page.getWidth() * 0.62
      const maxHeight = page.getHeight() * 0.26
      const scale = Math.min(maxWidth / watermark.width, maxHeight / watermark.height)
      const width = watermark.width * scale
      const height = watermark.height * scale
      page.drawImage(watermark, {
        x: (page.getWidth() - width) / 2,
        y: (page.getHeight() - height) / 2,
        width,
        height,
        opacity: watermarkOpacity,
      })
    }

    if (pageNumberFont) {
      const text = `${pageNumberStart + index} / ${pageNumberStart + plan.length - 1}`
      const fontSize = Math.max(9, Math.min(12, page.getWidth() / 55))
      const textWidth = pageNumberFont.widthOfTextAtSize(text, fontSize)
      const x = Math.max(8, (page.getWidth() - textWidth) / 2)
      const y = Math.max(8, fontSize * 0.9)
      page.drawRectangle({
        x: x - 5,
        y: y - 3,
        width: textWidth + 10,
        height: fontSize + 6,
        color: rgb(1, 1, 1),
        opacity: 0.72,
      })
      page.drawText(text, { x, y, size: fontSize, font: pageNumberFont, color: rgb(0.08, 0.08, 0.08), opacity: 0.9 })
    }
  })

  return output.save()
}

function validatePdfPagePlan(plan: readonly PdfPagePlanItem[], totalPages: number) {
  if (!plan.length) throw new Error("The organized PDF must contain at least one page")
  const used = new Set<number>()
  for (const page of plan) {
    if (!Number.isInteger(page.sourceIndex) || page.sourceIndex < 0 || page.sourceIndex >= totalPages) {
      throw new Error("The page plan contains an invalid source page")
    }
    if (used.has(page.sourceIndex)) throw new Error("The page plan contains a duplicate source page")
    used.add(page.sourceIndex)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
