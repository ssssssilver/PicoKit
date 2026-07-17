/// <reference lib="webworker" />

import type { PDFDocumentProxy } from "pdfjs-dist"

type LoadSourceMessage = { type: "load-source"; requestId: string; sourceId: string; buffer: ArrayBuffer }
type ThumbnailMessage = { type: "thumbnail"; requestId: string; sourceId: string; pageIndex: number; targetWidth: number; rotation: number }
type ReleaseSourceMessage = { type: "release-source"; sourceId: string }
type RequestMessage = LoadSourceMessage | ThumbnailMessage | ReleaseSourceMessage

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
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
    const previous = documents.get(message.sourceId)
    if (previous) await destroyDocument(previous)
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(message.buffer) })
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
      const scale = Math.max(0.1, Math.min(1, message.targetWidth / Math.max(1, baseViewport.width)))
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
