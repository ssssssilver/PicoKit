// Regression coverage for ISSUE-001 in
// .gstack/qa-reports/qa-report-localhost-3000-2026-07-17.md.
// A public /pdf.worker.min.mjs URL cannot be dynamically imported from the
// outer preview Worker under Vite/vinext, leaving every uploaded PDF unloaded.
import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("PDF preview worker asset wiring", () => {
  it("uses Vite's emitted worker asset URL instead of a public source import", async () => {
    const source = await readFile("workers/pdf-preview.worker.ts", "utf8")

    expect(source).toContain('import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"')
    expect(source).toContain("pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl")
    expect(source).not.toContain('pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"')
  })
})
