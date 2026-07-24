import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import { allTools, commonToolHrefs, visibleTools } from "@/lib/site"

describe("unified batch image workspace", () => {
  it("offers three optional panels inside one client workspace", async () => {
    const [workspace, navigation] = await Promise.all([
      readFile("components/image-batch-workspace.tsx", "utf8"),
      readFile("components/image-workflow-nav.tsx", "utf8"),
    ])

    expect(workspace).toContain("One image batch, one workspace")
    expect(workspace).toContain("optional tools, not required sequential steps")
    expect(workspace).toContain('dynamic(')
    expect(workspace).toContain("<BackgroundRemovalBatchStudio")
    expect(workspace).toContain("<QuickImageEditor")
    expect(workspace).toContain("<ImageDeliveryStudio")
    expect(workspace).toContain('showPanel("edit", files)')
    expect(workspace).toContain('showPanel("optimize", files)')
    expect(workspace).toContain("targetIsEmpty && files.length > 0")
    expect(workspace).toContain("workflowMemory.delete(panelMemoryKeys[next])")
    expect(workspace).toContain("onBatchChange={recordRemovalFiles}")
    expect(workspace).toContain("onBatchChange={recordEditorFiles}")
    expect(workspace).toContain("onBatchChange={recordOutputFiles}")
    expect(workspace).toContain("onBusyChange={setEditorBusy}")
    expect(workspace).toContain("onUnsavedChange={setEditorUnsaved}")
    expect(workspace).not.toContain("onBatchChange={(files)")
    expect(workspace).toContain("unsaved edits")
    expect(workspace).toContain("still processing images")
    expect(navigation).toContain('role="tablist"')
    expect(navigation).toContain('role="tab"')
    expect(navigation).toContain("Every tool is optional")
    expect(navigation).not.toContain("index + 1")
  })

  it("lets each engine exchange its latest batch without a route handoff", async () => {
    const [removal, editor, delivery] = await Promise.all([
      readFile("components/background-removal-batch-studio.tsx", "utf8"),
      readFile("components/quick-image-editor.tsx", "utf8"),
      readFile("components/image-delivery-studio.tsx", "utf8"),
    ])

    expect(removal).toContain("initialFiles?: readonly File[]")
    expect(removal).toContain("onBatchChange?.")
    expect(removal).toContain("onContinue(files)")
    expect(editor).toContain("initialFiles?: readonly File[]")
    expect(editor).toContain("item.edited?.file ?? item.file")
    expect(editor).toContain("onContinue(files)")
    expect(delivery).toContain("onBatchChange?.")
    expect(delivery).toContain("new File([item.result.blob]")
  })

  it("keeps legacy deep links on the same workspace and removes duplicate directory cards", async () => {
    const [removePage, editorPage, optimizerPage] = await Promise.all([
      readFile("app/remove-background/page.tsx", "utf8"),
      readFile("app/image-editor/page.tsx", "utf8"),
      readFile("app/image-compressor/page.tsx", "utf8"),
    ])

    for (const page of [removePage, editorPage, optimizerPage]) {
      expect(page).toContain("ImageBatchWorkspacePage")
    }
    expect(editorPage).toContain('initialPanel="edit"')
    expect(optimizerPage).toContain('initialPanel="optimize"')
    expect(allTools.some((tool) => tool.href === "/image-editor")).toBe(true)
    expect(allTools.some((tool) => tool.href === "/image-compressor")).toBe(true)
    expect(visibleTools.some((tool) => tool.href === "/image-editor")).toBe(false)
    expect(visibleTools.some((tool) => tool.href === "/image-compressor")).toBe(false)
    expect(commonToolHrefs).not.toContain("/image-editor")
    expect(commonToolHrefs).not.toContain("/image-compressor")
  })
})
