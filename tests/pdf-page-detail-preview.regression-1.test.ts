import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("PDF page detail preview", () => {
  it("opens a large on-device preview from a plain page click", async () => {
    const workspace = await readFile("components/pdf-workspace.tsx", "utf8")

    expect(workspace).toContain("setPreviewPageId(pageId)")
    expect(workspace).toContain('role="dialog"')
    expect(workspace).toContain("requestThumbnail(activePage.sourceId, activePage.sourcePageIndex, 1600")
    expect(workspace).toContain('data-pdf-page-id={page.id}')
  })

  it("supports keyboard navigation, close, and zoom controls", async () => {
    const workspace = await readFile("components/pdf-workspace.tsx", "utf8")

    expect(workspace).toContain('event.key === "ArrowLeft" || event.key === "ArrowUp"')
    expect(workspace).toContain('event.key === "ArrowRight" || event.key === "ArrowDown"')
    expect(workspace).toContain('event.key === "Escape"')
    expect(workspace).toContain('event.key === "+" || event.key === "="')
    expect(workspace).toContain('event.key === "0"')
    expect(workspace).toContain("方向键翻页")
  })

  it("exports the currently rendered page as a PNG", async () => {
    const [workspace, worker] = await Promise.all([
      readFile("components/pdf-workspace.tsx", "utf8"),
      readFile("workers/pdf-preview.worker.ts", "utf8"),
    ])

    expect(workspace).toContain("blob: Blob | null")
    expect(workspace).toContain("downloadBlob(imageBlob, imageFileName)")
    expect(workspace).toContain('pick("导出当前页 PNG", "Export page as PNG")')
    expect(workspace).toContain("sourcePageIndex + 1}.png")
    expect(worker).toContain("Math.min(4, message.targetWidth")
  })

  it("keeps modifier clicks dedicated to page multi-selection", async () => {
    const workspace = await readFile("components/pdf-workspace.tsx", "utf8")
    const selectionStart = workspace.indexOf("function selectPage")
    const selectionEnd = workspace.indexOf("function closePagePreview", selectionStart)
    const selectionLogic = workspace.slice(selectionStart, selectionEnd)

    expect(selectionLogic).toContain("event.shiftKey")
    expect(selectionLogic).toContain("event.ctrlKey || event.metaKey")
    expect(selectionLogic.lastIndexOf("setPreviewPageId(pageId)")).toBeGreaterThan(selectionLogic.lastIndexOf("event.ctrlKey || event.metaKey"))
  })
})
