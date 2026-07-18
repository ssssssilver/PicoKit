import { describe, expect, it } from "vitest"
import { PDFDocument, rgb } from "pdf-lib"

import { organizePdfWorkspaceBytes } from "@/lib/pdf-organizer"

describe("PDF page normalization", () => {
  it("crops and places mixed pages on a consistent A4 canvas without rasterizing", async () => {
    const source = await PDFDocument.create()
    const portrait = source.addPage([400, 700])
    portrait.drawRectangle({ x: 10, y: 10, width: 380, height: 680, color: rgb(0.1, 0.7, 0.8) })
    const landscape = source.addPage([700, 400])
    landscape.drawText("vector text", { x: 40, y: 200 })
    const bytes = await source.save()

    const result = await organizePdfWorkspaceBytes(
      [{ id: "source", bytes }],
      [
        { id: "p1", sourceId: "source", sourcePageIndex: 0, rotation: 0 },
        { id: "p2", sourceId: "source", sourcePageIndex: 1, rotation: 90 },
      ],
      {
        clearMetadata: true,
        pageNormalization: { cropMargin: 10, pageSize: "a4", orientation: "portrait", margin: 18 },
      },
    )

    const output = await PDFDocument.load(result, { updateMetadata: false })
    expect(output.getPageCount()).toBe(2)
    for (const page of output.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1)
      expect(page.getHeight()).toBeCloseTo(841.89, 1)
    }
  })
})
