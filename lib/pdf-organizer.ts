import { detectImageType } from "@/lib/file-validation"
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib"

export type PdfPagePlanItem = {
  id: string
  sourceIndex: number
  rotation: number
}

export type PdfWorkspacePage = {
  id: string
  sourceId: string
  sourcePageIndex: number
  rotation: number
}

export type PdfWorkspaceSource = {
  id: string
  bytes: ArrayBuffer | Uint8Array
}

export const PDF_MAX_FILE_BYTES = 150 * 1024 * 1024
export const PDF_MAX_BATCH_BYTES = 300 * 1024 * 1024
export const PDF_MAX_SOURCE_COUNT = 20
export const PDF_MAX_WORKSPACE_PAGES = 1_000

export type PdfWatermarkOptions = {
  pngBytes: Uint8Array
  opacity?: number
}

export type PdfOrganizerExportOptions = {
  pageNumbers?: boolean
  pageNumberStart?: number
  watermark?: PdfWatermarkOptions | null
  clearMetadata?: boolean
  metadata?: PdfDocumentMetadata | null
}

export type PdfDocumentMetadata = {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
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

export function createPdfWorkspacePages(sourceId: string, totalPages: number): PdfWorkspacePage[] {
  if (!sourceId || !Number.isInteger(totalPages) || totalPages < 0) return []
  return Array.from({ length: totalPages }, (_, sourcePageIndex) => ({
    id: `${sourceId}-page-${sourcePageIndex + 1}`,
    sourceId,
    sourcePageIndex,
    rotation: 0,
  }))
}

export function rotatePdfWorkspacePages(
  plan: readonly PdfWorkspacePage[],
  selectedIds: ReadonlySet<string>,
  degrees = 90,
) {
  return plan.map((page) => selectedIds.has(page.id)
    ? { ...page, rotation: normalizePdfRotation(page.rotation + degrees) }
    : page)
}

export function deletePdfWorkspacePages(plan: readonly PdfWorkspacePage[], selectedIds: ReadonlySet<string>) {
  return plan.filter((page) => !selectedIds.has(page.id))
}

export function movePdfWorkspacePages(
  plan: readonly PdfWorkspacePage[],
  selectedIds: ReadonlySet<string>,
  targetIndex: number,
) {
  const moving = plan.filter((page) => selectedIds.has(page.id))
  if (!moving.length) return [...plan]
  const stationary = plan.filter((page) => !selectedIds.has(page.id))
  const selectedBeforeTarget = plan.slice(0, Math.max(0, targetIndex)).filter((page) => selectedIds.has(page.id)).length
  const insertionIndex = Math.max(0, Math.min(stationary.length, targetIndex - selectedBeforeTarget))
  return [...stationary.slice(0, insertionIndex), ...moving, ...stationary.slice(insertionIndex)]
}

export function movePdfWorkspaceSelection(
  plan: readonly PdfWorkspacePage[],
  selectedIds: ReadonlySet<string>,
  direction: -1 | 1,
) {
  if (!selectedIds.size) return [...plan]
  const next = [...plan]
  if (direction < 0) {
    for (let index = 1; index < next.length; index++) {
      if (selectedIds.has(next[index].id) && !selectedIds.has(next[index - 1].id)) {
        ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      }
    }
  } else {
    for (let index = next.length - 2; index >= 0; index--) {
      if (selectedIds.has(next[index].id) && !selectedIds.has(next[index + 1].id)) {
        ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      }
    }
  }
  return next
}

export function reorderPdfWorkspaceSources(plan: readonly PdfWorkspacePage[], sourceOrder: readonly string[]) {
  const rank = new Map(sourceOrder.map((sourceId, index) => [sourceId, index]))
  return plan
    .map((page, index) => ({ page, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.page.sourceId) ?? Number.MAX_SAFE_INTEGER
      const rightRank = rank.get(right.page.sourceId) ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank || left.index - right.index
    })
    .map(({ page }) => page)
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

  applyPdfOutputMetadata(output, options)

  return output.save()
}

export async function organizePdfWorkspaceBytes(
  sources: readonly PdfWorkspaceSource[],
  plan: readonly PdfWorkspacePage[],
  options: PdfOrganizerExportOptions = {},
  onProgress?: (completed: number, total: number) => void,
) {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import("pdf-lib")
  validatePdfWorkspacePlan(plan)
  const output = await PDFDocument.create()
  const copiedByPage = new Map<string, PDFPage>()
  const pagesBySource = new Map<string, number[]>()

  for (const page of plan) {
    const indexes = pagesBySource.get(page.sourceId) ?? []
    indexes.push(page.sourcePageIndex)
    pagesBySource.set(page.sourceId, indexes)
  }

  let completed = 0
  for (const source of sources) {
    const requested = pagesBySource.get(source.id)
    if (!requested?.length) continue
    const document = await PDFDocument.load(source.bytes, { ignoreEncryption: false })
    const uniqueIndexes = [...new Set(requested)]
    if (uniqueIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= document.getPageCount())) {
      throw new Error("The workspace contains an invalid source page")
    }
    const copied = await output.copyPages(document, uniqueIndexes)
    uniqueIndexes.forEach((sourcePageIndex, index) => {
      copiedByPage.set(`${source.id}:${sourcePageIndex}`, copied[index])
    })
    completed += uniqueIndexes.length
    onProgress?.(completed, plan.length)
  }

  if (copiedByPage.size !== plan.length) throw new Error("A PDF source required by the workspace is missing")

  const pageNumberFont = options.pageNumbers ? await output.embedFont(StandardFonts.Helvetica) : null
  const watermark = options.watermark?.pngBytes?.length ? await output.embedPng(options.watermark.pngBytes) : null
  const watermarkOpacity = clamp(options.watermark?.opacity ?? 0.18, 0.05, 0.8)
  const pageNumberStart = Number.isFinite(options.pageNumberStart) ? Math.max(1, Math.round(options.pageNumberStart!)) : 1

  plan.forEach((planned, index) => {
    const page = copiedByPage.get(`${planned.sourceId}:${planned.sourcePageIndex}`)
    if (!page) throw new Error("A copied PDF page is missing")
    if (planned.rotation) page.setRotation(degrees(normalizePdfRotation(page.getRotation().angle + planned.rotation)))
    output.addPage(page)
    applyPdfPageDecoration(page, index, plan.length, pageNumberStart, pageNumberFont, watermark, watermarkOpacity, rgb)
    onProgress?.(completed + index + 1, plan.length * 2)
  })

  applyPdfOutputMetadata(output, options)

  return output.save()
}

function applyPdfOutputMetadata(document: import("pdf-lib").PDFDocument, options: PdfOrganizerExportOptions) {
  if (options.clearMetadata) {
    // pdf-lib creates a new document rather than copying the source Info
    // dictionary. Blank the common generated fields as well, and use a fixed
    // date so the rebuilt file does not disclose the local export time.
    document.setTitle("")
    document.setAuthor("")
    document.setSubject("")
    document.setKeywords([])
    document.setCreator("")
    document.setProducer("")
    document.setCreationDate(new Date(0))
    document.setModificationDate(new Date(0))
    return
  }

  const metadata = options.metadata
  if (!metadata) return
  // Custom mode also starts from a privacy-clean baseline: do not add the
  // library name or the user's local export time behind the explicit fields.
  document.setCreator("")
  document.setProducer("")
  document.setCreationDate(new Date(0))
  document.setModificationDate(new Date(0))
  if (metadata.title?.trim()) document.setTitle(metadata.title.trim())
  if (metadata.author?.trim()) document.setAuthor(metadata.author.trim())
  if (metadata.subject?.trim()) document.setSubject(metadata.subject.trim())
  if (metadata.keywords?.length) document.setKeywords(metadata.keywords.map((keyword) => keyword.trim()).filter(Boolean))
}

function applyPdfPageDecoration(
  page: PDFPage,
  index: number,
  totalPages: number,
  pageNumberStart: number,
  pageNumberFont: PDFFont | null,
  watermark: PDFImage | null,
  watermarkOpacity: number,
  rgb: typeof import("pdf-lib").rgb,
) {
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
    const text = `${pageNumberStart + index} / ${pageNumberStart + totalPages - 1}`
    const fontSize = Math.max(9, Math.min(12, page.getWidth() / 55))
    const textWidth = pageNumberFont.widthOfTextAtSize(text, fontSize)
    const x = Math.max(8, (page.getWidth() - textWidth) / 2)
    const y = Math.max(8, fontSize * 0.9)
    page.drawRectangle({ x: x - 5, y: y - 3, width: textWidth + 10, height: fontSize + 6, color: rgb(1, 1, 1), opacity: 0.72 })
    page.drawText(text, { x, y, size: fontSize, font: pageNumberFont, color: rgb(0.08, 0.08, 0.08), opacity: 0.9 })
  }
}

function validatePdfWorkspacePlan(plan: readonly PdfWorkspacePage[]) {
  if (!plan.length) throw new Error("The PDF workspace must contain at least one page")
  const used = new Set<string>()
  for (const page of plan) {
    if (!page.sourceId || !Number.isInteger(page.sourcePageIndex) || page.sourcePageIndex < 0) {
      throw new Error("The workspace contains an invalid source page")
    }
    const key = `${page.sourceId}:${page.sourcePageIndex}`
    if (used.has(key)) throw new Error("The workspace contains a duplicate source page")
    used.add(key)
  }
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
