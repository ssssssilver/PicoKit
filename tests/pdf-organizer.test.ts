import { readFile } from "node:fs/promises"
import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import {
  createPdfPagePlan,
  createPdfWorkspacePages,
  deletePdfWorkspacePages,
  deletePdfPage,
  detectPdfImageFormat,
  movePdfWorkspacePages,
  movePdfWorkspaceSelection,
  movePdfPage,
  normalizePdfRotation,
  organizePdfBytes,
  organizePdfWorkspaceBytes,
  reorderPdfWorkspaceSources,
  rotatePdfWorkspacePages,
  rotatePdfPage,
  PDF_MAX_BATCH_BYTES,
  PDF_MAX_FILE_BYTES,
  PDF_MAX_SOURCE_COUNT,
  PDF_MAX_WORKSPACE_PAGES,
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

describe("multi-source PDF workspace", () => {
  it("keeps browser-safe workspace limits explicit", () => {
    expect(PDF_MAX_FILE_BYTES).toBe(150 * 1024 * 1024)
    expect(PDF_MAX_BATCH_BYTES).toBe(300 * 1024 * 1024)
    expect(PDF_MAX_SOURCE_COUNT).toBe(20)
    expect(PDF_MAX_WORKSPACE_PAGES).toBe(1_000)
  })

  it("moves multi-selected pages, applies batch actions, and regroups sources", () => {
    const first = createPdfWorkspacePages("first", 3)
    const second = createPdfWorkspacePages("second", 2)
    const plan = [...first, ...second]
    const selected = new Set([first[1].id, first[2].id])

    const moved = movePdfWorkspacePages(plan, selected, plan.length)
    expect(moved.map((page) => page.id)).toEqual([first[0].id, second[0].id, second[1].id, first[1].id, first[2].id])
    expect(movePdfWorkspaceSelection(moved, selected, -1).map((page) => page.id)).toEqual([first[0].id, second[0].id, first[1].id, first[2].id, second[1].id])
    expect(rotatePdfWorkspacePages(plan, selected).filter((page) => selected.has(page.id)).every((page) => page.rotation === 90)).toBe(true)
    expect(deletePdfWorkspacePages(plan, selected).map((page) => page.id)).toEqual([first[0].id, second[0].id, second[1].id])
    expect(reorderPdfWorkspaceSources(moved, ["first", "second"]).map((page) => page.sourceId)).toEqual(["first", "first", "first", "second", "second"])
  })

  it("exports pages from multiple PDFs in workspace order", async () => {
    const first = await PDFDocument.create()
    first.addPage([200, 300])
    first.addPage([210, 310])
    const second = await PDFDocument.create()
    second.addPage([400, 500])

    const firstPages = createPdfWorkspacePages("first", 2)
    const secondPages = createPdfWorkspacePages("second", 1)
    const plan = [secondPages[0], firstPages[1], firstPages[0]]
    plan[1] = { ...plan[1], rotation: 90 }

    const bytes = await organizePdfWorkspaceBytes([
      { id: "first", bytes: await first.save() },
      { id: "second", bytes: await second.save() },
    ], plan, { pageNumbers: true })
    const output = await PDFDocument.load(bytes)

    expect(output.getPageCount()).toBe(3)
    expect(output.getPage(0).getSize()).toEqual({ width: 400, height: 500 })
    expect(output.getPage(1).getSize()).toEqual({ width: 210, height: 310 })
    expect(output.getPage(1).getRotation().angle).toBe(90)
    expect(output.getPage(2).getSize()).toEqual({ width: 200, height: 300 })
  })

  it("clears common output metadata or writes reviewed custom fields", async () => {
    const source = await PDFDocument.create()
    source.addPage([200, 300])
    source.setTitle("Sensitive source title")
    source.setAuthor("Source author")
    const plan = createPdfWorkspacePages("source", 1)

    const cleanedBytes = await organizePdfWorkspaceBytes([{ id: "source", bytes: await source.save() }], plan, { clearMetadata: true })
    const cleaned = await PDFDocument.load(cleanedBytes, { updateMetadata: false })
    expect(cleaned.getTitle()).toBe("")
    expect(cleaned.getAuthor()).toBe("")
    expect(cleaned.getCreationDate()?.getTime()).toBe(0)

    const customBytes = await organizePdfWorkspaceBytes([{ id: "source", bytes: await source.save() }], plan, {
      metadata: { title: "Delivery copy", author: "TabNative user", subject: "Reviewed", keywords: ["local", "pdf"] },
    })
    const custom = await PDFDocument.load(customBytes, { updateMetadata: false })
    expect(custom.getTitle()).toBe("Delivery copy")
    expect(custom.getAuthor()).toBe("TabNative user")
    expect(custom.getSubject()).toBe("Reviewed")
    expect(custom.getKeywords()).toContain("local")
    expect(custom.getCreator()).toBe("")
    expect(custom.getProducer()).toBe("")
    expect(custom.getModificationDate()?.getTime()).toBe(0)
  })

  it("ships one persistent workspace with lazy thumbnails and cancellable Worker export", async () => {
    const [workspace, tool, previewWorker, exportWorker] = await Promise.all([
      readFile("components/pdf-workspace.tsx", "utf8"),
      readFile("components/pdf-tool.tsx", "utf8"),
      readFile("workers/pdf-preview.worker.ts", "utf8"),
      readFile("workers/pdf-export.worker.ts", "utf8"),
    ])

    expect(tool).toContain('role="tabpanel"')
    expect(tool).toContain('hidden={mode !== "workspace"}')
    expect(tool).toContain("workspaceHandoff")
    expect(workspace).toContain("IntersectionObserver")
    expect(workspace).toContain("draggable={!running}")
    expect(workspace).toContain("event.shiftKey")
    expect(workspace).toContain("event.ctrlKey || event.metaKey")
    expect(workspace).toContain("movePdfWorkspacePages")
    expect(workspace).toContain("replacePlanAfterSourceChange")
    expect(workspace).toContain("exportWorkerRef.current?.terminate()")
    expect(previewWorker).toContain("OffscreenCanvas")
    expect(previewWorker).toContain("page.rotate + message.rotation")
    expect(exportWorker).toContain("organizePdfWorkspaceBytes")
  })
})
