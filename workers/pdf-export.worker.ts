/// <reference lib="webworker" />

import { organizePdfWorkspaceBytes, type PdfOrganizerExportOptions, type PdfWorkspacePage } from "@/lib/pdf-organizer"
import { pdfCompressionPreset, type PdfCompressionMode } from "@/lib/pdf-compression"

type WorkerExportOptions = PdfOrganizerExportOptions & { compressionMode?: PdfCompressionMode }

type ExportMessage = {
  type: "export"
  requestId: string
  sources: Array<{ id: string; buffer: ArrayBuffer }>
  pages: PdfWorkspacePage[]
  options: WorkerExportOptions
}

type SplitExportMessage = {
  type: "split-export"
  requestId: string
  sources: Array<{ id: string; buffer: ArrayBuffer }>
  groups: Array<{ label: string; pages: PdfWorkspacePage[] }>
  options: WorkerExportOptions
}

type WorkerCanvasAndContext = {
  canvas: OffscreenCanvas
  context: OffscreenCanvasRenderingContext2D
}

class OffscreenPdfCanvasFactory {
  create(width: number, height: number): WorkerCanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size")
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Offscreen canvas is unavailable")
    return { canvas, context }
  }

  reset(canvasAndContext: WorkerCanvasAndContext, width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size")
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: WorkerCanvasAndContext) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
  }
}

class OffscreenPdfFilterFactory {
  addFilter() { return "none" }
  addHCMFilter() { return "none" }
  addAlphaFilter() { return "none" }
  addLuminosityFilter() { return "none" }
  addKnockoutFilter() { return "none" }
  addHighlightHCMFilter() { return "none" }
  addSelectionHCMFilter() { return "none" }
  addSelectionFilter() { return "none" }
  createSelectionStyle() { return null }
  destroy() {}
}

const workerFontDocument = typeof self.fonts === "undefined"
  ? undefined
  : { fonts: self.fonts } as unknown as HTMLDocument

self.onmessage = async (event: MessageEvent<ExportMessage | SplitExportMessage>) => {
  const message = event.data
  try {
    if (message.type === "split-export") {
      const raster = pdfCompressionPreset(message.options.compressionMode ?? "structure").raster
      const workPerPage = raster ? 3 : 2
      const total = message.groups.reduce((sum, group) => sum + group.pages.length * workPerPage, 0)
      let completedBeforeGroup = 0
      const results: Array<{ label: string; buffer: ArrayBuffer }> = []
      for (const group of message.groups) {
        const organized = await organizePdfWorkspaceBytes(
          message.sources.map((source) => ({ id: source.id, bytes: source.buffer })),
          group.pages,
          message.options,
          (completed) => self.postMessage({
            type: "progress",
            requestId: message.requestId,
            completed: completedBeforeGroup + completed,
            total,
          }),
        )
        const bytes = raster
          ? await rasterCompressPdf(organized, message.options.compressionMode ?? "balanced", message.options, (completed) => self.postMessage({
              type: "progress",
              requestId: message.requestId,
              completed: completedBeforeGroup + group.pages.length * 2 + completed,
              total,
            }))
          : organized
        const buffer = Uint8Array.from(bytes).buffer
        results.push({ label: group.label, buffer })
        completedBeforeGroup += group.pages.length * workPerPage
      }
      self.postMessage({ type: "split-result", requestId: message.requestId, results }, results.map((result) => result.buffer))
      return
    }

    const compressionMode = message.options.compressionMode ?? "structure"
    const raster = pdfCompressionPreset(compressionMode).raster
    const totalWork = message.pages.length * (raster ? 3 : 2)
    const organized = await organizePdfWorkspaceBytes(
      message.sources.map((source) => ({ id: source.id, bytes: source.buffer })),
      message.pages,
      message.options,
      (completed) => {
        self.postMessage({ type: "progress", requestId: message.requestId, completed, total: totalWork })
      },
    )
    const bytes = raster
      ? await rasterCompressPdf(organized, compressionMode, message.options, (completed) => {
          self.postMessage({ type: "progress", requestId: message.requestId, completed: message.pages.length * 2 + completed, total: totalWork })
        })
      : organized
    const buffer = Uint8Array.from(bytes).buffer
    self.postMessage({ type: "result", requestId: message.requestId, buffer }, [buffer])
  } catch (reason) {
    self.postMessage({ type: "error", requestId: message.requestId, code: pdfErrorCode(reason), error: errorMessage(reason) })
  }
}

async function rasterCompressPdf(
  input: Uint8Array,
  mode: PdfCompressionMode,
  options: PdfOrganizerExportOptions,
  onProgress: (completed: number) => void,
) {
  const preset = pdfCompressionPreset(mode)
  if (!preset.raster) return input
  const pdfjs = await import("pdfjs-dist")
  const { PDFDocument } = await import("pdf-lib")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("/pdf.worker.min.mjs", self.location.origin).href
  const loadingTask = pdfjs.getDocument({
    CanvasFactory: OffscreenPdfCanvasFactory,
    FilterFactory: OffscreenPdfFilterFactory,
    cMapPacked: true,
    cMapUrl: new URL("/pdfjs/cmaps/", self.location.origin).href,
    data: Uint8Array.from(input),
    disableFontFace: !workerFontDocument,
    ownerDocument: workerFontDocument,
    standardFontDataUrl: new URL("/pdfjs/standard_fonts/", self.location.origin).href,
    useWorkerFetch: true,
    useSystemFonts: Boolean(workerFontDocument),
    wasmUrl: new URL("/pdfjs/wasm/", self.location.origin).href,
  })
  const source = await loadingTask.promise
  const output = await PDFDocument.create()
  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber++) {
      const page = await source.getPage(pageNumber)
      try {
        const baseViewport = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: preset.dpi / 72 })
        const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
        const context = canvas.getContext("2d", { alpha: false })
        if (!context) throw new Error("Offscreen canvas is unavailable")
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
          background: "#ffffff",
        }).promise
        const imageBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: preset.quality })
        const image = await output.embedJpg(new Uint8Array(await imageBlob.arrayBuffer()))
        const outputPage = output.addPage([baseViewport.width, baseViewport.height])
        outputPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height })
      } finally {
        page.cleanup()
      }
      onProgress(pageNumber)
    }
    applyRasterMetadata(output, options)
    return await output.save({ useObjectStreams: true })
  } finally {
    await source.cleanup().catch(() => undefined)
    await loadingTask.destroy().catch(() => undefined)
  }
}

function applyRasterMetadata(document: import("pdf-lib").PDFDocument, options: PdfOrganizerExportOptions) {
  document.setCreator("")
  document.setProducer("")
  document.setCreationDate(new Date(0))
  document.setModificationDate(new Date(0))
  if (options.clearMetadata) {
    document.setTitle("")
    document.setAuthor("")
    document.setSubject("")
    document.setKeywords([])
    return
  }
  const metadata = options.metadata
  if (!metadata) return
  if (metadata.title?.trim()) document.setTitle(metadata.title.trim())
  if (metadata.author?.trim()) document.setAuthor(metadata.author.trim())
  if (metadata.subject?.trim()) document.setSubject(metadata.subject.trim())
  if (metadata.keywords?.length) document.setKeywords(metadata.keywords.map((keyword) => keyword.trim()).filter(Boolean))
}

function pdfErrorCode(reason: unknown) {
  const message = errorMessage(reason).toLowerCase()
  const name = reason instanceof Error ? reason.name.toLowerCase() : ""
  if (name.includes("password") || message.includes("password") || message.includes("encrypted")) return "encrypted"
  if (message.includes("memory") || message.includes("allocation") || message.includes("array buffer")) return "memory"
  if (message.includes("invalid") || message.includes("missing") || message.includes("format")) return "invalid-pdf"
  return "export-failed"
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason || "PDF export failed")
}

export {}
