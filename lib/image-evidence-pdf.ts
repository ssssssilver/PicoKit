import { PDFDocument } from "pdf-lib"

const PAGE_WIDTH = 1240
const PAGE_HEIGHT = 1754
const PAGE_MARGIN = 96
const CONTENT_BOTTOM = PAGE_HEIGHT - 112
const PDF_WIDTH = 595.28
const PDF_HEIGHT = 841.89

type ReportLineKind = "title" | "heading" | "bullet" | "body" | "blank"

type ReportLine = {
  kind: ReportLineKind
  text: string
}

function parseReportLines(markdown: string): ReportLine[] {
  return markdown.split(/\r?\n/).map((rawLine) => {
    if (!rawLine.trim()) return { kind: "blank", text: "" }
    if (rawLine.startsWith("# ")) return { kind: "title", text: rawLine.slice(2) }
    if (rawLine.startsWith("## ")) return { kind: "heading", text: rawLine.slice(3) }
    if (rawLine.startsWith("- ")) return { kind: "bullet", text: rawLine.slice(2) }
    return { kind: "body", text: rawLine }
  })
}

function splitLongToken(
  context: CanvasRenderingContext2D,
  token: string,
  maxWidth: number,
) {
  const parts: string[] = []
  let current = ""
  for (const character of Array.from(token)) {
    const candidate = current + character
    if (current && context.measureText(candidate).width > maxWidth) {
      parts.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current) parts.push(current)
  return parts
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (!text) return [""]
  const tokens = text.match(/\S+\s*|\s+/gu) ?? [text]
  const lines: string[] = []
  let current = ""

  for (const token of tokens) {
    const candidate = current + token
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }

    const trimmed = token.trim()
    if (!trimmed) {
      if (current.trimEnd()) lines.push(current.trimEnd())
      current = ""
      continue
    }

    if (context.measureText(trimmed).width <= maxWidth) {
      if (current.trimEnd()) lines.push(current.trimEnd())
      current = trimmed
      continue
    }

    const parts = splitLongToken(context, `${current}${token.trimEnd()}`, maxWidth)
    lines.push(...parts.slice(0, -1))
    current = parts.at(-1) ?? ""
  }

  if (current.trimEnd()) lines.push(current.trimEnd())
  return lines.length ? lines : [""]
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to render the PDF report page"))
        return
      }
      void blob.arrayBuffer().then(resolve, reject)
    }, "image/png")
  })
}

function createPageCanvas() {
  const canvas = document.createElement("canvas")
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is unavailable")
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  context.fillStyle = "#22d3ee"
  context.fillRect(0, 0, PAGE_WIDTH, 14)
  return { canvas, context }
}

function drawPageChrome(
  context: CanvasRenderingContext2D,
  pageNumber: number,
  language: string,
) {
  context.textAlign = "left"
  context.direction = "ltr"
  context.fillStyle = "#0891b2"
  context.font = '700 20px Arial, "Microsoft YaHei", sans-serif'
  context.fillText("TABNATIVE · LOCAL REPORT", PAGE_MARGIN, 60)

  context.strokeStyle = "#e2e8f0"
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(PAGE_MARGIN, 78)
  context.lineTo(PAGE_WIDTH - PAGE_MARGIN, 78)
  context.stroke()

  context.fillStyle = "#64748b"
  context.font = '400 18px Arial, "Microsoft YaHei", sans-serif'
  context.fillText(
    language.startsWith("zh") ? `第 ${pageNumber} 页` : `Page ${pageNumber}`,
    PAGE_MARGIN,
    PAGE_HEIGHT - 48,
  )
  context.textAlign = "right"
  context.fillText("tabnative.modone0622.workers.dev", PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 48)
  context.textAlign = "left"
}

function lineStyle(kind: ReportLineKind) {
  if (kind === "title") {
    return { font: '700 42px Arial, "Microsoft YaHei", sans-serif', color: "#0f172a", lineHeight: 58, before: 24, after: 24 }
  }
  if (kind === "heading") {
    return { font: '700 28px Arial, "Microsoft YaHei", sans-serif', color: "#0f172a", lineHeight: 40, before: 26, after: 10 }
  }
  if (kind === "bullet") {
    return { font: '400 23px Arial, "Microsoft YaHei", sans-serif', color: "#334155", lineHeight: 34, before: 3, after: 5 }
  }
  return { font: '400 23px Arial, "Microsoft YaHei", sans-serif', color: "#334155", lineHeight: 34, before: 3, after: 5 }
}

export async function buildImageEvidencePdf(
  markdown: string,
  language: string,
) {
  if (typeof document === "undefined") {
    throw new Error("PDF reports can only be generated in a browser")
  }

  await document.fonts?.ready
  const pages: HTMLCanvasElement[] = []
  let pageNumber = 1
  let { canvas, context } = createPageCanvas()
  drawPageChrome(context, pageNumber, language)
  let y = 112

  const finishPage = () => {
    pages.push(canvas)
    pageNumber += 1
    const next = createPageCanvas()
    canvas = next.canvas
    context = next.context
    drawPageChrome(context, pageNumber, language)
    y = 112
  }

  for (const line of parseReportLines(markdown)) {
    if (line.kind === "blank") {
      y += 14
      continue
    }

    const style = lineStyle(line.kind)
    context.font = style.font
    const indent = line.kind === "bullet" ? 34 : 0
    const wrapped = wrapText(context, line.text, PAGE_WIDTH - PAGE_MARGIN * 2 - indent)
    const requiredHeight = style.before + wrapped.length * style.lineHeight + style.after
    if (y + requiredHeight > CONTENT_BOTTOM && y > 140) finishPage()

    y += style.before
    context.fillStyle = style.color
    context.textAlign = "left"
    context.direction = "ltr"
    if (line.kind === "bullet") {
      context.fillStyle = "#06b6d4"
      context.beginPath()
      context.arc(PAGE_MARGIN + 8, y - 7, 5, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = style.color
    }
    for (const wrappedLine of wrapped) {
      context.fillText(wrappedLine, PAGE_MARGIN + indent, y)
      y += style.lineHeight
    }
    y += style.after
  }
  pages.push(canvas)

  const pdf = await PDFDocument.create()
  pdf.setTitle(language.startsWith("zh") ? "TabNative 图片来源证据报告" : "TabNative Image Source-Evidence Report")
  pdf.setAuthor("TabNative")
  pdf.setCreator("TabNative browser PDF exporter")
  pdf.setProducer("TabNative")

  for (const pageCanvas of pages) {
    const png = await pdf.embedPng(await canvasToPng(pageCanvas))
    const page = pdf.addPage([PDF_WIDTH, PDF_HEIGHT])
    page.drawImage(png, { x: 0, y: 0, width: PDF_WIDTH, height: PDF_HEIGHT })
  }

  return pdf.save()
}
