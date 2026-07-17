/// <reference lib="webworker" />

import { organizePdfWorkspaceBytes, type PdfOrganizerExportOptions, type PdfWorkspacePage } from "@/lib/pdf-organizer"

type ExportMessage = {
  type: "export"
  requestId: string
  sources: Array<{ id: string; buffer: ArrayBuffer }>
  pages: PdfWorkspacePage[]
  options: PdfOrganizerExportOptions
}

self.onmessage = async (event: MessageEvent<ExportMessage>) => {
  const message = event.data
  if (message.type !== "export") return
  try {
    const bytes = await organizePdfWorkspaceBytes(
      message.sources.map((source) => ({ id: source.id, bytes: source.buffer })),
      message.pages,
      message.options,
      (completed, total) => {
        self.postMessage({ type: "progress", requestId: message.requestId, completed, total })
      },
    )
    const buffer = Uint8Array.from(bytes).buffer
    self.postMessage({ type: "result", requestId: message.requestId, buffer }, [buffer])
  } catch (reason) {
    self.postMessage({ type: "error", requestId: message.requestId, code: pdfErrorCode(reason), error: errorMessage(reason) })
  }
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
