import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import {
  clampEditorCrop,
  editorOutputDimensions,
  editorOutputName,
  getEditorPreviewSize,
  IMAGE_EDITOR_HISTORY_LIMIT,
  IMAGE_EDITOR_MAX_PIXELS,
} from "@/lib/image-editor"

describe("lightweight image editor limits and geometry", () => {
  it("keeps small images at source resolution and bounds large previews", () => {
    expect(getEditorPreviewSize(1200, 800)).toEqual({ width: 1200, height: 800, sourceScale: 1 })
    expect(getEditorPreviewSize(4000, 3000)).toEqual({ width: 2048, height: 1536, sourceScale: 4000 / 2048 })
    expect(() => getEditorPreviewSize(0, 100)).toThrow("Invalid image dimensions")
  })

  it("clamps crop rectangles to the editable canvas", () => {
    expect(clampEditorCrop({ left: -20, top: 30, width: 1200, height: 900 }, 1000, 700)).toEqual({ left: 0, top: 30, width: 1000, height: 670 })
    expect(clampEditorCrop({ left: 950, top: 680, width: 0, height: 0 }, 1000, 700)).toEqual({ left: 950, top: 680, width: 1, height: 1 })
  })

  it("derives source-size exports and safe filenames", () => {
    expect(editorOutputDimensions(1024, 768, 4000 / 2048)).toEqual({ width: 2000, height: 1500 })
    expect(editorOutputName("holiday.photo.PNG", "image/jpeg")).toBe("holiday.photo-edited.jpg")
    expect(editorOutputName("scan", "image/webp")).toBe("scan-edited.webp")
    expect(editorOutputName("透明图.png", "image/png")).toBe("透明图-edited.png")
  })

  it("keeps the lightweight product limits explicit", () => {
    expect(IMAGE_EDITOR_MAX_PIXELS).toBe(24_000_000)
    expect(IMAGE_EDITOR_HISTORY_LIMIT).toBe(30)
  })

  it("supports a selectable batch queue without discarding unsaved edits silently", async () => {
    const editor = await readFile("components/quick-image-editor.tsx", "utf8")

    expect(editor).toContain('type="file" multiple')
    expect(editor).toContain("function selectItem(id: string)")
    expect(editor).toContain("dirty && !window.confirm")
    expect(editor).toContain('exportImage("queue")')
    expect(editor).toContain('pick("保存到队列", "Save to queue")')
    expect(editor).toContain('await import("jszip")')
    expect(editor).toContain("for (const item of edited)")
    expect(editor).toContain("loadLocalAssetBatch(batchId)")
    expect(editor).toContain("saveLocalAssetBatch(queue.map")
    expect(editor).toContain("/image-compressor?batch=")
    expect(editor).toContain("up to 30 images")
    expect(editor).toContain("allowLargeLocalResults")
    expect(editor).toContain('workflowMemory.get<EditorQueueSnapshot>("image-editor")')
    expect(editor).toContain('workflowMemory.set<EditorQueueSnapshot>("image-editor"')
    expect(editor).toContain("await waitForBrowserPaint()")
    expect(editor).toContain('aria-live="polite"')
  })
})
