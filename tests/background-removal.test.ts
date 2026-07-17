import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import {
  BACKGROUND_REFINEMENT_MAX_PIXELS,
  GENERAL_BACKGROUND_MODEL,
  backgroundModelCacheUrl,
  backgroundRefinementShortcut,
  backgroundRemovalOutputName,
  canRefineBackground,
  normalizeSaliencyMask,
  sourceBrushSize,
} from "@/lib/background-removal"
import { resolveModelProxyTarget, toModelProxyUrl } from "@/lib/model-proxy"

describe("background removal release boundary", () => {
  it("pins one lightweight people-and-objects model with verified GPU and CPU paths", async () => {
    const worker = await readFile("workers/background-removal.worker.ts", "utf8")

    expect(GENERAL_BACKGROUND_MODEL).toEqual({
      id: "Heliosoph/u2net-onnx",
      revision: "7fc34deee10329bc039c10a73b98090d0c6f5c59",
      weightFile: "u2netp.onnx",
      sha256: "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8",
      estimatedDownloadBytes: 4_574_861,
      inputSize: 320,
    })
    expect(worker).toContain('executionProviders: ["webgpu"]')
    expect(worker).toContain('executionProviders: ["wasm"]')
    expect(worker).toContain("GENERAL_BACKGROUND_MODEL.sha256")
    expect(worker).toContain("normalizeSaliencyMask")
    expect(worker).toContain('throw new Error("general-model-load-failed")')
    expect(worker).not.toContain("BiRefNet")
    expect(worker).not.toContain("PORTRAIT_BACKGROUND_MODEL")
    expect(worker).not.toContain('mode: "portrait"')
  })

  it("allows the reviewed general model while keeping the proxy closed to other repositories", () => {
    const candidate = "https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx"
    expect(toModelProxyUrl(candidate, "https://tabnative.example")).toBe("https://tabnative.example/_models/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx")
    expect(resolveModelProxyTarget("https://tabnative.example/_models/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx")).toBe(candidate)
    expect(toModelProxyUrl("https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx", "https://tabnative.example")).toBeNull()
    expect(toModelProxyUrl("https://huggingface.co/onnx-community/BEN2-ONNX/resolve/main/onnx/model_fp16.onnx", "https://tabnative.example")).toBeNull()

    expect(toModelProxyUrl("https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx", "https://tabnative.example")).toBeNull()
    expect(backgroundModelCacheUrl()).toBe(
      `https://huggingface.co/${GENERAL_BACKGROUND_MODEL.id}/resolve/${GENERAL_BACKGROUND_MODEL.revision}/u2netp.onnx`,
    )
  })
})

describe("local alpha-mask refinement", () => {
  it("uses a lower memory guard than inference for multi-surface editing", () => {
    expect(canRefineBackground(4000, 3000)).toBe(true)
    expect(4000 * 3000).toBe(BACKGROUND_REFINEMENT_MAX_PIXELS)
    expect(canRefineBackground(4001, 3000)).toBe(false)
    expect(canRefineBackground(0, 3000)).toBe(false)
    expect(canRefineBackground(Number.NaN, 3000)).toBe(false)
  })

  it("scales the preview brush to source pixels and clamps unsafe values", () => {
    expect(sourceBrushSize(40, 4000, 1000)).toBe(160)
    expect(sourceBrushSize(1, 4000, 1000)).toBe(16)
    expect(sourceBrushSize(999, 4000, 1000)).toBe(640)
    expect(sourceBrushSize(40, 0, 1000)).toBe(1)
  })

  it("creates stable branded PNG output names", () => {
    expect(backgroundRemovalOutputName("portrait.jpg")).toBe("portrait-removebg-tabnative.png")
    expect(backgroundRemovalOutputName("campaign.v2.webp")).toBe("campaign.v2-removebg-tabnative.png")
    expect(backgroundRemovalOutputName(".png")).toBe("image-removebg-tabnative.png")
    expect(backgroundRemovalOutputName("   ")).toBe("image-removebg-tabnative.png")
  })

  it("normalizes a saliency map into a safe alpha channel", () => {
    expect([...normalizeSaliencyMask(new Float32Array([0.25, 0.5, 0.75]))]).toEqual([0, 128, 255])
    expect([...normalizeSaliencyMask(new Float32Array([1, 1, 1]))]).toEqual([0, 0, 0])
    expect([...normalizeSaliencyMask([Number.NaN, 0, 1])]).toEqual([0, 0, 255])
  })

  it("uses familiar, non-browser-reserved refinement shortcuts", () => {
    expect(backgroundRefinementShortcut({ key: "z", ctrlKey: true })).toBe("undo")
    expect(backgroundRefinementShortcut({ key: "Z", metaKey: true })).toBe("undo")
    expect(backgroundRefinementShortcut({ key: "r" })).toBe("reset")
    expect(backgroundRefinementShortcut({ key: "r", ctrlKey: true })).toBeNull()
    expect(backgroundRefinementShortcut({ key: "z", ctrlKey: true, shiftKey: true })).toBeNull()
  })

  it("keeps visible feedback between file-picker launch and validated selection", async () => {
    const dropzone = await readFile("components/file-dropzone.tsx", "utf8")
    expect(dropzone).toContain("setChoosing(true)")
    expect(dropzone).toContain("正在等待图片选择")
    expect(dropzone).toContain("setPendingFile(next)")
    expect(dropzone).toContain("正在读取并验证图片")
    expect(dropzone).toContain('role="status"')
  })

  it("shows the refinement brush and source previews while keeping provenance outside the edit flow", async () => {
    const [editor, remover, delivery, workflow, detectorPage, header] = await Promise.all([
      readFile("components/background-mask-editor.tsx", "utf8"),
      readFile("components/background-remover-tool.tsx", "utf8"),
      readFile("components/image-delivery-studio.tsx", "utf8"),
      readFile("components/image-workflow-nav.tsx", "utf8"),
      readFile("app/ai-image-detector/page.tsx", "utf8"),
      readFile("components/site-header.tsx", "utf8"),
    ])

    expect(editor).toContain("brushCursor.visible")
    expect(editor).toContain("cursor-none")
    expect(editor).toContain('aria-label={pick("预览缩放", "Preview zoom")}')
    expect(editor).toContain("const MIN_ZOOM = 0.25")
    expect(editor).toContain("const MAX_ZOOM = 2")
    expect(editor).toContain("changeZoom(-1)")
    expect(editor).toContain("changeZoom(1)")
    expect(editor).toContain("setZoom(1)")
    expect(remover).toContain("原图预览")
    expect(delivery).toContain("previewUrl: URL.createObjectURL")
    expect(delivery).toContain("已显示原图预览")
    expect(delivery).not.toContain("Inspect provenance")
    expect(workflow).not.toContain("来源检查")
    expect(workflow).not.toContain('id: "inspect"')
    expect(workflow).not.toContain("串行处理与 ZIP")
    expect(workflow).not.toContain("点选队列逐张编辑")
    expect(workflow).not.toContain("格式、尺寸、目标 KB")
    expect(detectorPage).not.toContain("ImageWorkflowNav")
    expect(header.indexOf('href="/remove-background"')).toBeLessThan(header.indexOf('href="/ai-image-detector"'))
    expect(header).toContain('href="https://github.com/ssssssilver/PicoKit"')
    expect(header).toContain('rel="noopener noreferrer"')
    expect(header).toContain("lg:grid")
  })

  it("processes background-removal batches sequentially and packages completed results", async () => {
    const [batch, page] = await Promise.all([
      readFile("components/background-removal-batch-studio.tsx", "utf8"),
      readFile("app/remove-background/page.tsx", "utf8"),
    ])

    expect(batch).toContain('type="file" multiple')
    expect(batch).toContain("async function processQueue()")
    expect(batch).toContain("for (const item of snapshot)")
    expect(batch).toContain("await processOne(item)")
    expect(batch).toContain('await import("jszip")')
    expect(batch).toContain("backgroundRemovalOutputName(item.file.name)")
    expect(batch).toContain('pick("处理完当前项后停止", "Stop after current")')
    expect(batch).toContain("setSelectedId(item.id)")
    expect(batch).toContain("<BackgroundMaskEditor")
    expect(batch).toContain("function applyRefinement(id: string, blob: Blob)")
    expect(batch).toContain("result: { ...current.result, blob, url }")
    expect(batch).toContain("individual download, and ZIP")
    expect(batch).toContain("You can refine edges after background removal")
    expect(batch).toContain("Refine the first result")
    expect(batch).toContain('pick("修正边缘", "Refine edges")')
    expect(batch).toContain("saveLocalAssetBatch(completed.map")
    expect(batch).toContain("/image-editor?batch=")
    expect(batch).toContain('workflowMemory.get<BackgroundQueueSnapshot>("remove-background")')
    expect(batch).toContain('workflowMemory.set<BackgroundQueueSnapshot>("remove-background"')
    expect(batch).toContain("await waitForBrowserPaint()")
    expect(batch).toContain("flushSync(() =>")
    expect(batch).toContain("aria-busy={adding}")
    expect(batch).toContain('aria-live="polite"')
    expect(batch).toContain("workflow-preview-action")
    expect(batch).toContain("Select result to refine edges")
    expect(page).not.toContain("BackgroundRemoverTool")
    expect(page).not.toContain("<details")
  })
})
