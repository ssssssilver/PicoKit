import { describe, expect, it } from "vitest"

import { canRasterCompressPdf, pdfCompressionPreset } from "@/lib/pdf-compression"

describe("PDF compression tiers", () => {
  it("keeps structural optimization separate from lossy raster tiers", () => {
    expect(pdfCompressionPreset("structure").raster).toBe(false)
    expect(pdfCompressionPreset("balanced")).toMatchObject({ raster: true, dpi: 110, quality: 0.78 })
    expect(pdfCompressionPreset("smallest").dpi).toBeLessThan(pdfCompressionPreset("balanced").dpi)
  })

  it("caps browser raster compression at 200 pages", () => {
    expect(canRasterCompressPdf(200)).toBe(true)
    expect(canRasterCompressPdf(201)).toBe(false)
    expect(canRasterCompressPdf(0)).toBe(false)
  })
})
