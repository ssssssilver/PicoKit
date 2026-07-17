/// <reference lib="webworker" />

import {
  aggregateImageViews,
  IMAGE_PIXEL_DETECTOR_VERSION,
  IMAGE_PIXEL_MODEL_ID,
  IMAGE_PIXEL_MODEL_REVISION,
  type ImageClassifierLabel,
} from "@/lib/image-detector-core"
import { toModelProxyUrl } from "@/lib/model-proxy"

type RawImageLike = {
  width: number
  height: number
  crop: (bounds: [number, number, number, number]) => Promise<RawImageLike>
}

type Classifier = (input: RawImageLike | RawImageLike[], options?: Record<string, unknown>) => Promise<ImageClassifierLabel[] | ImageClassifierLabel[][]>

let classifier: Classifier | null = null
let activeBackend = "wasm"

async function loadClassifier(preferWebGpu: boolean) {
  if (classifier) return classifier
  const { env, pipeline } = await import("@huggingface/transformers")
  env.allowLocalModels = false
  env.useBrowserCache = true
  const nativeFetch = fetch.bind(globalThis)
  env.fetch = async (input, init) => {
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
  const progress_callback = (progress: { status?: string; progress?: number; file?: string }) => {
    self.postMessage({ type: "progress", stage: progress.status || "loading", progress: progress.progress || 0, file: progress.file })
  }

  if (preferWebGpu && "gpu" in navigator) {
    try {
      activeBackend = "webgpu"
      classifier = await pipeline("image-classification", IMAGE_PIXEL_MODEL_ID, {
        device: "webgpu",
        dtype: "fp16",
        progress_callback,
        revision: IMAGE_PIXEL_MODEL_REVISION,
      }) as unknown as Classifier
      return classifier
    } catch {
      classifier = null
    }
  }

  activeBackend = "wasm"
  classifier = await pipeline("image-classification", IMAGE_PIXEL_MODEL_ID, {
    device: "wasm",
    dtype: "q8",
    progress_callback,
    revision: IMAGE_PIXEL_MODEL_REVISION,
  }) as unknown as Classifier
  return classifier
}

async function createViews(image: RawImageLike) {
  const views: RawImageLike[] = [image]
  const names = ["full"]
  const side = Math.min(image.width, image.height)
  if (side < 320) return { views, names }

  const maxX = image.width - side
  const maxY = image.height - side
  const positions: Array<[string, number, number]> = [
    ["center", Math.round(maxX / 2), Math.round(maxY / 2)],
    ["top-left", 0, 0],
    ["top-right", maxX, 0],
    ["bottom-left", 0, maxY],
    ["bottom-right", maxX, maxY],
  ]

  const seen = new Set<string>()
  for (const [name, x, y] of positions) {
    const key = `${x}:${y}:${side}`
    if (seen.has(key)) continue
    seen.add(key)
    views.push(await image.crop([x, y, x + side - 1, y + side - 1]))
    names.push(name)
  }
  return { views, names }
}

self.onmessage = async (event: MessageEvent<{ type: "analyze"; buffer: ArrayBuffer; mime: string; preferWebGpu: boolean }>) => {
  if (event.data.type !== "analyze") return
  try {
    self.postMessage({ type: "status", stage: "preparing-model" })
    const pipe = await loadClassifier(event.data.preferWebGpu)
    const { RawImage } = await import("@huggingface/transformers")
    self.postMessage({ type: "status", stage: "decoding-image" })
    const image = await RawImage.fromBlob(new Blob([event.data.buffer], { type: event.data.mime })) as unknown as RawImageLike
    const { views, names } = await createViews(image)
    self.postMessage({ type: "status", stage: "analyzing-views", views: views.length })
    const raw = await pipe(views, { top_k: null })
    const outputs = Array.isArray(raw[0]) ? raw as ImageClassifierLabel[][] : [raw as ImageClassifierLabel[]]
    self.postMessage({ type: "result", result: aggregateImageViews(outputs, names, activeBackend, IMAGE_PIXEL_DETECTOR_VERSION) })
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : "Image model inference failed" })
  }
}

export {}
