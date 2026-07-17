import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import {
  createPdfPagePlan,
  deletePdfPage,
  detectPdfImageFormat,
  movePdfPage,
  normalizePdfRotation,
  organizePdfBytes,
  rotatePdfPage,
} from "@/lib/pdf-organizer"

describe("PDF image input validation", () => {
  it("uses file signatures instead of declared MIME or filename", () => {
    expect(detectPdfImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]))).toBe("jpeg")
    expect(detectPdfImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png")
    expect(detectPdfImageFormat(new TextEncoder().encode("RIFF0000WEBP"))).toBeNull()
    expect(detectPdfImageFormat(new TextEncoder().encode("not an image"))).toBeNull()
  })
})

describe("PDF organizer page plan", () => {
  it("creates, reorders, rotates, and removes pages without mutating the original plan", () => {
    const original = createPdfPagePlan(3)
    const moved = movePdfPage(original, 2, -1)
    const rotated = rotatePdfPage(moved, 1)
    const removed = deletePdfPage(rotated, 0)

    expect(original.map((page) => page.sourceIndex)).toEqual([0, 1, 2])
    expect(moved.map((page) => page.sourceIndex)).toEqual([0, 2, 1])
    expect(rotated[1]).toMatchObject({ sourceIndex: 2, rotation: 90 })
    expect(removed.map((page) => page.sourceIndex)).toEqual([2, 1])
  })

  it("keeps moves inside the plan and normalizes quarter-turn rotations", () => {
    const plan = createPdfPagePlan(2)
    expect(movePdfPage(plan, 0, -1)).toEqual(plan)
    expect(movePdfPage(plan, 1, 1)).toEqual(plan)
    expect(normalizePdfRotation(450)).toBe(90)
    expect(normalizePdfRotation(-90)).toBe(270)
  })
})

describe("PDF organizer export", () => {
  it("exports the selected page order, deletion, rotation, and page numbers", async () => {
    const source = await PDFDocument.create()
    source.addPage([200, 300])
    source.addPage([300, 400])
    source.addPage([400, 500])

    let plan = createPdfPagePlan(3)
    plan = movePdfPage(plan, 2, -1)
    plan = movePdfPage(plan, 1, -1)
    plan = deletePdfPage(plan, 2)
    plan = rotatePdfPage(plan, 1)

    const bytes = await organizePdfBytes(await source.save(), plan, { pageNumbers: true })
    const output = await PDFDocument.load(bytes)

    expect(output.getPageCount()).toBe(2)
    expect(output.getPage(0).getSize()).toEqual({ width: 400, height: 500 })
    expect(output.getPage(1).getSize()).toEqual({ width: 200, height: 300 })
    expect(output.getPage(1).getRotation().angle).toBe(90)
  })

  it("accepts a locally rendered PNG watermark", async () => {
    const source = await PDFDocument.create()
    source.addPage([200, 300])
    const transparentPixel = Uint8Array.from(Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ))

    const bytes = await organizePdfBytes(await source.save(), createPdfPagePlan(1), {
      watermark: { pngBytes: transparentPixel, opacity: 0.25 },
    })

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})
