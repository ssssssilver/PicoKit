import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  buildPdfPageSelection,
  formatPdfPageSelection,
  layoutPdfImage,
  parsePdfPageSpec,
  resolvePdfPageSize,
  sanitizePdfFileName,
} from "@/lib/pdf-conversion"

const conversionStudioSource = readFileSync(
  new URL("../components/pdf-conversion-studios.tsx", import.meta.url),
  "utf8",
)
const localeCodes = ["ja", "ko", "es", "pt", "id", "de", "pl", "ru", "fr", "ar", "tr"]
const pageSelectionMessages = [
  "Preview and click the pages you want to export as PNG, JPG, or WebP; multiple pages are bundled in a ZIP.",
  "150 MB maximum · 12 previews per group",
  "Page previews",
  "Pages {start}-{end} of {count}",
  "All {count} pages can be previewed in groups of {size}. Use the arrows to switch groups.",
  "Some pages in this group could not be previewed. You can still select and convert them by page number.",
  "Select first {count} pages",
  "Select current group",
  "Click to select or clear pages; hold Shift to select a continuous range. Up to {count} pages per run.",
  "To protect browser memory, the first {count} pages were selected. Clear some pages to choose others.",
  "Select up to {count} pages per run. Clear some pages first.",
  "Select at least one page.",
  "Convert up to {count} pages at a time; clear some selected pages.",
  "Unable to convert the pages. Select fewer pages or lower the scale.",
  "Unable to create a large preview for this page. You can still select and convert it.",
  "Previous image",
  "Next image",
  "Close",
]

describe("PDF conversion planning", () => {
  it("parses ranges once and clamps them to the document", () => {
    expect(parsePdfPageSpec("1-3, 3, 5, 99", 6)).toEqual([0, 1, 2, 4])
    expect(parsePdfPageSpec("bad", 10)).toEqual([])
  })

  it("builds click-selection presets without exceeding the browser page limit", () => {
    expect(buildPdfPageSelection(6)).toEqual([0, 1, 2, 3, 4, 5])
    expect(buildPdfPageSelection(8, "odd")).toEqual([0, 2, 4, 6])
    expect(buildPdfPageSelection(8, "even")).toEqual([1, 3, 5, 7])
    expect(buildPdfPageSelection(500, "all", 3)).toEqual([0, 1, 2])
  })

  it("summarizes selected page buttons as readable ranges", () => {
    expect(formatPdfPageSelection([4, 0, 1, 2, 4, 8])).toBe("1-3, 5, 9")
    expect(formatPdfPageSelection([])).toBe("")
  })

  it("uses page buttons instead of a manually typed PDF-to-image range", () => {
    expect(conversionStudioSource).not.toContain("const [pageSpec")
    expect(conversionStudioSource).not.toContain("setPageSpec")
    expect(conversionStudioSource).toContain('aria-pressed={selected}')
    expect(conversionStudioSource).toContain('onClick={(event) => togglePageSelection(pageIndex, event.shiftKey)}')
  })

  it("paginates thumbnail previews across the entire PDF", () => {
    expect(conversionStudioSource).toContain("const PDF_PREVIEW_PAGE_SIZE = 12")
    expect(conversionStudioSource).toContain("Math.ceil(pageCount / PDF_PREVIEW_PAGE_SIZE)")
    expect(conversionStudioSource).toContain("changePreviewPage(previewPage + 1)")
    expect(conversionStudioSource).not.toContain("Math.min(12, pdf.numPages)")
    expect(conversionStudioSource).not.toContain("previews for the first 12 pages")
  })

  it("uses explicit light-mode contrast for preview states and controls", () => {
    expect(conversionStudioSource).toContain("border-cyan-700 bg-white")
    expect(conversionStudioSource).toContain("bg-cyan-700 py-1.5")
    expect(conversionStudioSource).toContain("border-slate-300 bg-white text-slate-900")
    expect(conversionStudioSource).toContain("bg-slate-100 py-1.5")
  })

  it("opens large previews from both image conversion queues", () => {
    expect(conversionStudioSource).toContain("function ImagePreviewDialog")
    expect(conversionStudioSource).toContain("setPreviewItemId(item.id)")
    expect(conversionStudioSource).toContain("openPdfPagePreview(pageIndex)")
    expect(conversionStudioSource).toContain("previewRenderRef")
    expect(conversionStudioSource).toContain('event.key === "ArrowLeft"')
    expect(conversionStudioSource).toContain('event.key === "Escape"')
  })

  it("localizes the visible page-selection workflow in every supported language", () => {
    for (const locale of localeCodes) {
      const messages = JSON.parse(readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url), "utf8"))
      for (const message of pageSelectionMessages) {
        expect(messages[message], `${locale}: ${message}`).toBeTruthy()
      }
    }
  })

  it("resolves physical page size and orientation", () => {
    expect(resolvePdfPageSize(1200, 800, "original", "auto")).toEqual({ width: 900, height: 600 })
    const a4 = resolvePdfPageSize(1200, 800, "a4", "auto")
    expect(a4.width).toBeGreaterThan(a4.height)
  })

  it("lays images out with contain or cover behavior", () => {
    expect(layoutPdfImage(600, 800, 1200, 800, 20, "contain")).toEqual({ x: 20, y: 213.33333333333334, width: 560, height: 373.3333333333333 })
    const cover = layoutPdfImage(600, 800, 1200, 800, 0, "cover")
    expect(cover.width).toBeGreaterThan(600)
    expect(cover.height).toBe(800)
  })

  it("creates a safe PDF download name", () => {
    expect(sanitizePdfFileName(" quarterly:report ", "tabnative-pdf")).toBe("quarterly-report.pdf")
    expect(sanitizePdfFileName("", "tabnative-pdf")).toBe("tabnative-pdf.pdf")
  })
})
