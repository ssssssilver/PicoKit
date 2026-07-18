/// <reference lib="webworker" />

import type { PDFDocumentProxy } from "pdfjs-dist"
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

type LoadSourceMessage = { type: "load-source"; requestId: string; sourceId: string; buffer: ArrayBuffer }
type ThumbnailMessage = { type: "thumbnail"; requestId: string; sourceId: string; pageIndex: number; targetWidth: number; rotation: number }
type ReleaseSourceMessage = { type: "release-source"; sourceId: string }
type RequestMessage = LoadSourceMessage | ThumbnailMessage | ReleaseSourceMessage
type WorkerCanvasAndContext = {
  canvas: OffscreenCanvas
  context: OffscreenCanvasRenderingContext2D
}

class OffscreenPdfCanvasFactory {
  create(width: number, height: number): WorkerCanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error("invalid-canvas-size")
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("canvas-unavailable")
    return { canvas, context }
  }

  reset(canvasAndContext: WorkerCanvasAndContext, width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error("invalid-canvas-size")
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

// PDF.js normally registers embedded fonts through document.fonts. This
// previewer runs its display layer inside a dedicated Worker, where there is no
// DOM document, but modern browsers expose the equivalent Worker font set as
// self.fonts. Supplying it keeps embedded CJK invoice glyphs available to the
// OffscreenCanvas. Older browsers fall back to PDF.js path-based glyph drawing.
const workerFontDocument = typeof self.fonts === "undefined"
  ? undefined
  : { fonts: self.fonts } as unknown as HTMLDocument

const documents = new Map<string, PDFDocumentProxy>()
let thumbnailQueue = Promise.resolve()

self.onmessage = (event: MessageEvent<RequestMessage>) => {
  const message = event.data
  if (message.type === "release-source") {
    const document = documents.get(message.sourceId)
    documents.delete(message.sourceId)
    void destroyDocument(document)
    return
  }

  if (message.type === "load-source") {
    void loadSource(message)
    return
  }

  thumbnailQueue = thumbnailQueue.then(() => renderThumbnail(message)).catch(() => undefined)
}

async function loadSource(message: LoadSourceMessage) {
  try {
    const pdfjs = await import("pdfjs-dist")
    // This module already runs in a dedicated Worker. When PDF.js falls back to
    // its in-process worker, it imports workerSrc from here, so the URL must be
    // emitted by Vite instead of pointing at a /public asset (which Vite blocks
    // when imported as source code during development).
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const previous = documents.get(message.sourceId)
    if (previous) await destroyDocument(previous)
    const loadingTask = pdfjs.getDocument({
      CanvasFactory: OffscreenPdfCanvasFactory,
      FilterFactory: OffscreenPdfFilterFactory,
      data: new Uint8Array(message.buffer),
      disableFontFace: !workerFontDocument,
      ownerDocument: workerFontDocument,
      // The PDF display layer itself runs inside this Worker, so its default
      // DOMBinaryDataFactory cannot resolve decoder assets through `document`.
      // Let the nested PDF.js worker fetch them directly instead.
      cMapPacked: true,
      cMapUrl: "/pdfjs/cmaps/",
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      useSystemFonts: Boolean(workerFontDocument),
      useWorkerFetch: true,
      wasmUrl: "/pdfjs/wasm/",
    })
    const document = await loadingTask.promise
    documents.set(message.sourceId, document)
    self.postMessage({ type: "source-loaded", requestId: message.requestId, sourceId: message.sourceId, pages: document.numPages })
  } catch (reason) {
    self.postMessage({ type: "error", requestId: message.requestId, code: pdfErrorCode(reason), error: errorMessage(reason) })
  }
}

async function renderThumbnail(message: ThumbnailMessage) {
  try {
    const document = documents.get(message.sourceId)
    if (!document) throw new Error("source-missing")
    if (typeof OffscreenCanvas === "undefined") throw new Error("offscreen-unavailable")
    const page = await document.getPage(message.pageIndex + 1)
    try {
      const rotation = ((page.rotate + message.rotation) % 360 + 360) % 360
      const baseViewport = page.getViewport({ scale: 1, rotation })
      // Grid thumbnails stay below 1x, while the detail dialog may request a
      // higher-resolution raster for inspection and single-page PNG export.
      const scale = Math.max(0.1, Math.min(4, message.targetWidth / Math.max(1, baseViewport.width)))
      const viewport = page.getViewport({ scale, rotation })
      const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)))
      const context = canvas.getContext("2d", { alpha: false })
      if (!context) throw new Error("canvas-unavailable")
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        background: "#ffffff",
      }).promise
      const blob = await canvas.convertToBlob({ type: "image/png" })
      self.postMessage({ type: "thumbnail", requestId: message.requestId, sourceId: message.sourceId, pageIndex: message.pageIndex, blob })
    } finally {
      page.cleanup()
    }
  } catch (reason) {
    self.postMessage({ type: "error", requestId: message.requestId, code: pdfErrorCode(reason), error: errorMessage(reason) })
  }
}

function pdfErrorCode(reason: unknown) {
  const message = errorMessage(reason).toLowerCase()
  const name = reason instanceof Error ? reason.name.toLowerCase() : ""
  if (name.includes("password") || message.includes("password") || message.includes("encrypted")) return "encrypted"
  if (message.includes("offscreen") || message.includes("canvas")) return "thumbnail-unavailable"
  if (message.includes("invalid") || message.includes("format") || message.includes("header")) return "invalid-pdf"
  return "pdf-load-failed"
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason || "PDF processing failed")
}

async function destroyDocument(document: PDFDocumentProxy | undefined) {
  if (!document) return
  try {
    await document.cleanup()
  } catch {
    // Cleanup is best effort; the loading task still needs to be destroyed.
  }
  await document.loadingTask.destroy().catch(() => undefined)
}

export {}
