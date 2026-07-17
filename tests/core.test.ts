import { describe, expect, it, vi } from "vitest"
import { File as NodeFile } from "node:buffer"
import { readFile } from "node:fs/promises"

import { readableLoadError } from "@/components/model-converter-tool"
import { detectImageType, validateImageFile } from "@/lib/file-validation"
import { outputSize, searchTargetSize, sourceCrop } from "@/lib/image-transformer"
import { aiScore, normalizeOutput, splitText } from "@/lib/text-detector-core"
import { aggregateImageViews, aiImageScore, attachVisibleAiMarkEvidence, fuseImageDetection } from "@/lib/image-detector-core"
import type { ImageInspection } from "@/lib/image-types"
import { isModelProxyRequest, resolveModelProxyTarget, toModelProxyUrl } from "@/lib/model-proxy"
import { isModelInputFormat, modelOutputName, outputKeepsRichScene, selectPrimaryModelFile } from "@/lib/model-converter-core"
import { exportModelData } from "@/lib/model-exporter"

describe("image file validation", () => {
  it("detects supported formats from magic bytes instead of the filename", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg")
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png")
    expect(detectImageType(new TextEncoder().encode("RIFF0000WEBP"))?.mime).toBe("image/webp")
    expect(detectImageType(new TextEncoder().encode("<script>"))).toBeNull()
  })

  it("accepts valid image bytes and normalizes an incorrect declared MIME", async () => {
    vi.stubGlobal("File", NodeFile)
    const close = vi.fn()
    vi.stubGlobal("createImageBitmap", vi.fn(async (file: File) => {
      expect(file.type).toBe("image/png")
      return { width: 2, height: 3, close }
    }))
    const source = new NodeFile(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])],
      "actually-png.jpg",
      { type: "image/jpeg", lastModified: 123 },
    ) as unknown as File

    const result = await validateImageFile(source)

    expect(result).toMatchObject({ mime: "image/png", format: "PNG", width: 2, height: 3, pixels: 6 })
    expect(result.file).not.toBe(source)
    expect(result.file.name).toBe(source.name)
    expect(result.file.type).toBe("image/png")
    expect(result.file.lastModified).toBe(123)
    expect(close).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})

describe("3D model converter core", () => {
  it("recognizes supported model inputs and selects the richest primary file", () => {
    expect(isModelInputFormat("glb")).toBe(true)
    expect(isModelInputFormat("step")).toBe(false)
    const primary = selectPrimaryModelFile([{ name: "mesh.stl" }, { name: "scene.gltf" }, { name: "texture.png" }])
    expect(primary?.name).toBe("scene.gltf")
  })

  it("creates a safe output name and identifies rich-scene output", () => {
    expect(modelOutputName("robot.v2.fbx", "glb")).toBe("robot.v2-converted.glb")
    expect(outputKeepsRichScene("glb")).toBe(true)
    expect(outputKeepsRichScene("obj")).toBe(false)
  })

  it("does not misreport a generic fetch failure as a missing related file", () => {
    expect(readableLoadError(new TypeError("Failed to fetch"), "zh-CN")).toContain("未能读取所选本地模型")
    expect(readableLoadError(new Error('THREE.GLTFLoader: Failed to load buffer "mesh.bin".'), "zh-CN")).toContain("BIN、MTL 或贴图")
  })

  it("allows local blob and data model resources in the production policy", async () => {
    const workerSource = await readFile("worker/index.ts", "utf8")
    expect(workerSource).toContain("connect-src 'self' blob: data: https://huggingface.co")
  })

  it.each(["glb", "obj", "stl", "ply"] as const)("exports a valid non-empty %s payload", async (format) => {
    class BrowserFileReader {
      result: ArrayBuffer | null = null
      onloadend: (() => void) | null = null
      readAsArrayBuffer(blob: Blob) {
        void blob.arrayBuffer().then((buffer) => {
          this.result = buffer
          this.onloadend?.()
        })
      }
    }
    vi.stubGlobal("FileReader", BrowserFileReader)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0))
    const THREE = await import("three")
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x67e8f9 }))
    const blob = await exportModelData(mesh, [], format, 1024)
    expect(blob.size).toBeGreaterThan(32)
  })
})

describe("text detector core", () => {
  it("keeps chunks within the model window and caps the total", () => {
    const chunks = splitText(Array.from({ length: 40 }, (_, index) => `Paragraph ${index} ${"x".repeat(1700)}`).join("\n\n"))
    expect(chunks).toHaveLength(24)
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(1800)
  })

  it("normalizes single results and resolves AI/human labels", () => {
    const normalized = normalizeOutput([{ label: "Human", score: 0.8 }, { label: "AI", score: 0.2 }], 1)
    expect(normalized).toHaveLength(1)
    expect(aiScore(normalized[0])).toBeCloseTo(0.2)
    expect(aiScore([{ label: "Real", score: 0.3 }])).toBeCloseTo(0.7)
  })
})

describe("model download fallback", () => {
  const approvedModels = [
    "onnx-community/tmr-ai-text-detector-ONNX",
    "onnx-community/ai-image-detect-distilled-ONNX",
    "Heliosoph/u2net-onnx",
  ]

  it.each(approvedModels)("maps the approved %s model to a same-origin fallback", (model) => {
    const remote = `https://huggingface.co/${model}/resolve/main/onnx/model_quantized.onnx`
    const proxy = `https://picokit.example/_models/${model}/resolve/main/onnx/model_quantized.onnx`
    expect(toModelProxyUrl(remote, "https://picokit.example")).toBe(proxy)
    expect(isModelProxyRequest(proxy)).toBe(true)
    expect(resolveModelProxyTarget(proxy)).toBe(remote)
  })

  it("does not turn TabNative into an open proxy", () => {
    expect(toModelProxyUrl("https://example.com/model.onnx", "https://picokit.example")).toBeNull()
    expect(resolveModelProxyTarget("https://picokit.example/_models/other/model/resolve/main/model.onnx")).toBeNull()
  })

  it("uses the same-origin route first in every browser inference worker", async () => {
    const workers = await Promise.all([
      readFile("workers/background-removal.worker.ts", "utf8"),
      readFile("workers/image-detector.worker.ts", "utf8"),
      readFile("workers/text-detector.worker.ts", "utf8"),
    ])
    for (const source of workers) {
      expect(source).toContain("nativeFetch(proxyUrl ?? request.url, requestInit)")
      expect(source).toContain("cache: request.cache")
      expect(source).not.toContain("return await nativeFetch(request.url, requestInit)")
    }
  })

  it("prevents one-byte model metadata probes from poisoning the browser cache", async () => {
    const workerSource = await readFile("worker/index.ts", "utf8")
    expect(workerSource).toContain('isModelProxyRequest(request.url) && secured.status === 206')
    expect(workerSource).toContain('secured.headers.set("Cache-Control", "no-store")')
  })
})

describe("AI image detector core", () => {
  const inspection: ImageInspection = {
    fileName: "sample.png",
    mime: "image/png",
    format: "PNG",
    bytes: 1024,
    width: 1024,
    height: 1024,
    metadata: [],
    signals: [],
    c2pa: { present: false, validated: null, summary: "none" },
    risk: "unknown",
    note: "",
  }

  it("normalizes fake and real classifier labels", () => {
    expect(aiImageScore([{ label: "fake", score: 0.83 }, { label: "real", score: 0.17 }])).toBeCloseTo(0.83)
    expect(aiImageScore([{ label: "real", score: 0.9 }])).toBeCloseTo(0.1)
  })

  it("aggregates multiple image regions and measures their consistency", () => {
    const result = aggregateImageViews([
      [{ label: "fake", score: 0.8 }],
      [{ label: "fake", score: 0.7 }],
      [{ label: "fake", score: 0.75 }],
    ], ["full", "center", "top-left"], "wasm", "test-model")
    expect(result.score).toBeCloseTo(0.75)
    expect(result.consistency).toBeGreaterThan(0.8)
    expect(result.views).toHaveLength(3)
  })

  it("keeps uncertain pixel results uncertain without explicit provenance", () => {
    const pixel = aggregateImageViews([[{ label: "fake", score: 0.55 }]], ["full"], "wasm", "test-model")
    expect(fuseImageDetection(pixel, inspection).band).toBe("uncertain")
  })

  it("lets strong explicit AI provenance override a conflicting low pixel score", () => {
    const pixel = aggregateImageViews([[{ label: "fake", score: 0.12 }]], ["full"], "wasm", "test-model")
    const withSignal: ImageInspection = { ...inspection, signals: [{ id: "generator", label: "Generator", value: "Stable Diffusion", group: "ai", severity: "high" }] }
    const fused = fuseImageDetection(pixel, withSignal)
    expect(fused.band).toBe("higher-ai-signals")
    expect(fused.evidenceAgreement).toBe("conflict")
    expect(fused.reliability).toBe("low")
  })

  it("treats a detected visible AI platform mark as strong combined evidence", () => {
    const pixel = aggregateImageViews([[{ label: "fake", score: 0.12 }]], ["full"], "wasm", "test-model")
    const withMark = attachVisibleAiMarkEvidence(inspection, { provider: "doubao", confidence: 0.87, region: null })
    const fused = fuseImageDetection(pixel, withMark)
    expect(fused.band).toBe("higher-ai-signals")
    expect(fused.overallScore).toBeGreaterThanOrEqual(0.94)
    expect(fused.visibleMarkSignalCount).toBe(1)
    expect(fused.evidenceAgreement).toBe("conflict")
    expect(fused.reliability).toBe("medium")
  })

  it("keeps a visible AI mark conclusive when the pixel model is unavailable", () => {
    const withMark = attachVisibleAiMarkEvidence(inspection, { provider: "jimeng", confidence: 0.91, region: null })
    const fused = fuseImageDetection(null, withMark)
    expect(fused.band).toBe("higher-ai-signals")
    expect(fused.pixelScore).toBeNull()
    expect(fused.overallScore).toBeGreaterThanOrEqual(0.94)
    expect(fused.evidenceAgreement).toBe("provenance-only")
  })
})

describe("image transform geometry", () => {
  it("applies aspect ratio, maximum edge and safety scale", () => {
    expect(outputSize(4000, 3000, { format: "image/jpeg", quality: 0.8, aspect: "1:1", maxEdge: 1200 })).toEqual({ width: 1200, height: 1200 })
    expect(outputSize(4000, 3000, { format: "image/jpeg", quality: 0.8, width: 1000, aspect: "4:3" }, 0.84)).toEqual({ width: 840, height: 630 })
  })

  it("computes a centered crop", () => {
    expect(sourceCrop(4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 })
    expect(sourceCrop(2000, 3000, 16 / 9)).toEqual({ sx: 0, sy: 938, sw: 2000, sh: 1125 })
  })

  it("searches quality and then scales down to approach a target size", async () => {
    const result = await searchTargetSize(async (scale, quality) => ({
      blob: new Blob([new Uint8Array(Math.round(2_000 * quality * scale * scale))]),
      width: Math.round(1000 * scale),
      height: Math.round(800 * scale),
    }), 900, 0.9)
    expect(result.targetReached).toBe(true)
    expect(result.blob.size).toBeLessThanOrEqual(900)
    expect(result.blob.size).toBeGreaterThan(850)
  })
})
