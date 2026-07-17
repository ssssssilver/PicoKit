/// <reference lib="webworker" />

import type { InferenceSession } from "onnxruntime-web"

import { toModelProxyUrl } from "@/lib/model-proxy"
import {
  GENERAL_BACKGROUND_MODEL,
  backgroundModelCacheUrl,
  normalizeSaliencyMask,
} from "@/lib/background-removal"

type ProcessMessage = {
  type: "process"
  buffer: ArrayBuffer
  mime: string
  preferWebGpu: boolean
}

let activeBackend = "wasm"
let objectSession: InferenceSession | null = null
let objectModelBytes: ArrayBuffer | null = null

type OrtModule = typeof import("onnxruntime-web/webgpu")
let ortModule: OrtModule | null = null
const nativeFetch = fetch.bind(globalThis)

async function fetchModel(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init)
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new Error("Model downloads only support GET and HEAD requests")
  }
  const requestInit: RequestInit = {
    method: request.method,
    headers: request.headers,
    cache: request.cache,
    redirect: request.redirect,
    signal: request.signal,
  }
  const proxyUrl = toModelProxyUrl(request.url, self.location.origin)
  return nativeFetch(proxyUrl ?? request.url, requestInit)
}

async function loadOrt() {
  if (!ortModule) {
    ortModule = await import("onnxruntime-web/webgpu")
    ortModule.env.wasm.numThreads = self.crossOriginIsolated
      ? Math.max(1, Math.min(4, self.navigator.hardwareConcurrency || 1))
      : 1
  }
  return ortModule
}

async function hasWebGpuAdapter(preferWebGpu: boolean) {
  if (!preferWebGpu) return false
  const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    return Boolean(await gpu.requestAdapter())
  } catch {
    return false
  }
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

async function readResponseWithProgress(response: Response) {
  if (!response.body) return response.arrayBuffer()
  const total = Number(response.headers.get("content-length")) || GENERAL_BACKGROUND_MODEL.estimatedDownloadBytes
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let lastReportedProgress = -1
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    const progress = Math.min(90, Math.floor(received / total * 90))
    if (progress > lastReportedProgress) {
      lastReportedProgress = progress
      self.postMessage({
        type: "progress",
        stage: "downloading-background-model",
        progress,
      })
    }
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

async function loadObjectModelBytes() {
  if (objectModelBytes) return objectModelBytes
  const remoteUrl = backgroundModelCacheUrl()
  let response: Response | undefined
  try {
    response = await caches.match(remoteUrl) ?? undefined
  } catch {
    // Cache Storage can be unavailable in private browsing. A network fetch
    // remains sufficient for the current in-memory session.
  }
  if (!response) {
    response = await fetchModel(remoteUrl, { method: "GET", redirect: "follow" })
  }
  if (!response.ok) throw new Error("general-model-load-failed")

  const bytes = await readResponseWithProgress(response)
  if (bytes.byteLength !== GENERAL_BACKGROUND_MODEL.estimatedDownloadBytes) {
    throw new Error("general-model-integrity-failed")
  }
  if (await sha256Hex(bytes) !== GENERAL_BACKGROUND_MODEL.sha256) {
    throw new Error("general-model-integrity-failed")
  }

  objectModelBytes = bytes
  try {
    const cache = await caches.open("tabnative-models-v1")
    await cache.put(remoteUrl, new Response(bytes.slice(0), {
      headers: { "content-type": "application/octet-stream" },
    }))
  } catch {
    // Private browsing and storage pressure can disable Cache Storage.
    // In-memory inference should still continue for the current operation.
  }
  return objectModelBytes
}

async function loadObjectSession(preferWebGpu: boolean) {
  if (objectSession) return objectSession
  const [ort, bytes, webGpuAvailable] = await Promise.all([
    loadOrt(),
    loadObjectModelBytes(),
    hasWebGpuAdapter(preferWebGpu),
  ])

  if (webGpuAvailable) {
    try {
      objectSession = await ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"] })
      activeBackend = "webgpu"
      return objectSession
    } catch {
      objectSession = null
    }
  }

  try {
    objectSession = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] })
    activeBackend = "wasm"
    return objectSession
  } catch {
    objectSession = null
    throw new Error("general-model-load-failed")
  }
}

async function inferObjectMask(source: Blob) {
  if (!objectSession) throw new Error("general-model-load-failed")
  const bitmap = await createImageBitmap(source)
  try {
    const size = GENERAL_BACKGROUND_MODEL.inputSize
    const preview = new OffscreenCanvas(size, size)
    const previewContext = preview.getContext("2d", { willReadFrequently: true })
    if (!previewContext) throw new Error("general-processing-failed")
    previewContext.drawImage(bitmap, 0, 0, size, size)
    const pixels = previewContext.getImageData(0, 0, size, size).data
    const planeSize = size * size
    const input = new Float32Array(planeSize * 3)
    const mean = [0.485, 0.456, 0.406]
    const standardDeviation = [0.229, 0.224, 0.225]
    for (let index = 0; index < planeSize; index += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        input[channel * planeSize + index] = (pixels[index * 4 + channel] / 255 - mean[channel]) / standardDeviation[channel]
      }
    }

    const ort = await loadOrt()
    const tensor = new ort.Tensor("float32", input, [1, 3, size, size])
    const outputMap = await objectSession.run({ [objectSession.inputNames[0]]: tensor })
    const output = outputMap[objectSession.outputNames[0]]
    if (!output || output.type !== "float32" || !(output.data instanceof Float32Array) || output.data.length < planeSize) {
      throw new Error("general-processing-failed")
    }
    const mask = normalizeSaliencyMask(output.data)
    const maskPixels = new Uint8ClampedArray(planeSize * 4)
    for (let index = 0; index < planeSize; index += 1) {
      const offset = index * 4
      maskPixels[offset] = 255
      maskPixels[offset + 1] = 255
      maskPixels[offset + 2] = 255
      maskPixels[offset + 3] = mask[index]
    }

    const maskCanvas = new OffscreenCanvas(size, size)
    const maskContext = maskCanvas.getContext("2d")
    const outputCanvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const outputContext = outputCanvas.getContext("2d")
    if (!maskContext || !outputContext) throw new Error("general-processing-failed")
    maskContext.putImageData(new ImageData(maskPixels, size, size), 0, 0)
    outputContext.drawImage(bitmap, 0, 0)
    outputContext.globalCompositeOperation = "destination-in"
    outputContext.imageSmoothingEnabled = true
    outputContext.imageSmoothingQuality = "high"
    outputContext.drawImage(maskCanvas, 0, 0, bitmap.width, bitmap.height)
    const blob = await outputCanvas.convertToBlob({ type: "image/png" })
    return { blob, width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

async function removeObjectBackground(source: Blob, preferWebGpu: boolean) {
  await loadObjectSession(preferWebGpu)
  try {
    return await inferObjectMask(source)
  } catch (error) {
    if (activeBackend !== "webgpu") throw error
    objectSession?.release()
    objectSession = null
    await loadObjectSession(false)
    return inferObjectMask(source)
  }
}

self.onmessage = async (event: MessageEvent<ProcessMessage>) => {
  if (event.data.type !== "process") return
  let stage: "loading" | "processing" | "encoding" = "loading"
  try {
    self.postMessage({ type: "status", stage: "loading-background-model" })
    const source = new Blob([event.data.buffer], { type: event.data.mime })
    await loadObjectSession(event.data.preferWebGpu)
    stage = "processing"
    self.postMessage({ type: "status", stage: "removing-background" })
    const output = await removeObjectBackground(source, event.data.preferWebGpu)
    stage = "encoding"
    self.postMessage({ type: "status", stage: "encoding-png" })
    const buffer = await output.blob.arrayBuffer()
    self.postMessage({
      type: "result",
      buffer,
      width: output.width,
      height: output.height,
      backend: activeBackend,
      model: GENERAL_BACKGROUND_MODEL.id,
      revision: GENERAL_BACKGROUND_MODEL.revision,
    }, [buffer])
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Background removal failed"
    const code = raw === "general-model-load-failed" || raw === "general-model-integrity-failed"
      ? raw
      : stage === "loading"
        ? "general-model-load-failed"
        : "general-processing-failed"
    self.postMessage({ type: "error", code, error: raw })
  }
}

export {}
