import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("advanced PDF workspace experience", () => {
  it("connects all three PDF modes without a re-upload", async () => {
    const [tool, studios, workspace] = await Promise.all([
      readFile("components/pdf-tool.tsx", "utf8"),
      readFile("components/pdf-conversion-studios.tsx", "utf8"),
      readFile("components/pdf-workspace.tsx", "utf8"),
    ])
    expect(tool).toContain("workspaceHandoff")
    expect(tool).toContain("imageHandoff")
    expect(studios).toContain("继续到页面工作台")
    expect(workspace).toContain("继续转图片")
  })

  it("windows the page grid and provides cancellable imports and opt-in drafts", async () => {
    const workspace = await readFile("components/pdf-workspace.tsx", "utf8")
    expect(workspace).toContain("VirtualPdfPageGrid")
    expect(workspace).toContain("Stopping after the current file")
    expect(workspace).toContain("savePdfWorkspaceDraft")
    expect(workspace).toContain("保存本地草稿")
  })

  it("runs split, normalization, and lossy compression in the export worker", async () => {
    const [workspace, worker] = await Promise.all([
      readFile("components/pdf-workspace.tsx", "utf8"),
      readFile("workers/pdf-export.worker.ts", "utf8"),
    ])
    expect(workspace).toContain("批量拆分")
    expect(workspace).toContain("裁边与页面规范化")
    expect(workspace).toContain("有损压缩会改变页面内容")
    expect(worker).toContain('type: "split-result"')
    expect(worker).toContain("OffscreenCanvas")
    expect(worker).toContain("wasmUrl")
  })
})
