// Regression coverage for ISSUE-001 in
// .gstack/qa-reports/qa-report-localhost-3000-2026-07-17.md.
// A public /pdf.worker.min.mjs URL cannot be dynamically imported from the
// outer preview Worker under Vite/vinext, leaving every uploaded PDF unloaded.
import { access, readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("PDF preview worker asset wiring", () => {
  it("uses Vite's emitted worker asset URL instead of a public source import", async () => {
    const source = await readFile("workers/pdf-preview.worker.ts", "utf8")

    expect(source).toContain('import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"')
    expect(source).toContain("pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl")
    expect(source).not.toContain('pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"')
  })

  it("provides the local PDF image decoders used by JPEG 2000 and JBIG2 pages", async () => {
    const [worker, conversionStudio, assetScript] = await Promise.all([
      readFile("workers/pdf-preview.worker.ts", "utf8"),
      readFile("components/pdf-conversion-studios.tsx", "utf8"),
      readFile("scripts/prepare-assets.mjs", "utf8"),
    ])

    expect(worker).toContain('wasmUrl: "/pdfjs/wasm/"')
    expect(worker).toContain("useWorkerFetch: true")
    expect(worker).toContain("CanvasFactory: OffscreenPdfCanvasFactory")
    expect(worker).toContain("new OffscreenCanvas(width, height)")
    expect(conversionStudio).toContain('wasmUrl: "/pdfjs/wasm/"')
    expect(conversionStudio).toContain("useWorkerFetch: true")
    expect(assetScript).toContain('"openjpeg.wasm"')
    expect(assetScript).toContain('"jbig2.wasm"')
    expect(assetScript).toContain('"qcms_bg.wasm"')
  })

  it("ships the CMaps and fallback fonts required by CID-font invoices", async () => {
    const [worker, assetScript] = await Promise.all([
      readFile("workers/pdf-preview.worker.ts", "utf8"),
      readFile("scripts/prepare-assets.mjs", "utf8"),
    ])

    expect(worker).toContain('cMapUrl: "/pdfjs/cmaps/"')
    expect(worker).toContain("cMapPacked: true")
    expect(worker).toContain('standardFontDataUrl: "/pdfjs/standard_fonts/"')
    expect(assetScript).toContain('["cmaps", "standard_fonts"]')
    await Promise.all([
      access("public/pdfjs/cmaps/Adobe-CNS1-UCS2.bcmap"),
      access("public/pdfjs/standard_fonts/LiberationSans-Regular.ttf"),
    ])
  })

  it("registers embedded PDF fonts inside the preview Worker", async () => {
    const [previewWorker, exportWorker] = await Promise.all([
      readFile("workers/pdf-preview.worker.ts", "utf8"),
      readFile("workers/pdf-export.worker.ts", "utf8"),
    ])

    for (const worker of [previewWorker, exportWorker]) {
      expect(worker).toContain("const workerFontDocument")
      expect(worker).toContain("fonts: self.fonts")
      expect(worker).toContain("ownerDocument: workerFontDocument")
      expect(worker).toContain("disableFontFace: !workerFontDocument")
    }
  })

  it("keeps page badges readable in light mode and edits pages from the detail dialog", async () => {
    const workspace = await readFile("components/pdf-workspace.tsx", "utf8")

    expect(workspace).toContain("bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-[#fff]")
    expect(workspace).toContain("onRotatePage")
    expect(workspace).toContain("onMovePage")
    expect(workspace).toContain("onTogglePageSelection")
    expect(workspace).toContain("onRemovePage")
    expect(workspace).toContain('pick("编辑当前页", "Edit this page")')
  })
})
