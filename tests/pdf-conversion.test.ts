import { describe, expect, it } from "vitest"

import {
  layoutPdfImage,
  parsePdfPageSpec,
  resolvePdfPageSize,
  sanitizePdfFileName,
} from "@/lib/pdf-conversion"

describe("PDF conversion planning", () => {
  it("parses ranges once and clamps them to the document", () => {
    expect(parsePdfPageSpec("1-3, 3, 5, 99", 6)).toEqual([0, 1, 2, 4])
    expect(parsePdfPageSpec("bad", 10)).toEqual([])
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
