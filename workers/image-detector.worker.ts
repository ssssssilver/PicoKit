/// <reference lib="webworker" />

import {
  aggregateImageViews,
  buildImageViewPlan,
  combinePixelModelResults,
  IMAGE_PIXEL_DETECTOR_VERSION,
  IMAGE_PIXEL_MODEL_ID,
  IMAGE_PIXEL_MODEL_REVISION,
  IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
  IMAGE_PIXEL_SECONDARY_MODEL_ID,
  IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
  shouldRunSecondaryPixelModel,
  type ImageClassifierLabel,
} from "@/lib/image-detector-core"
import { toModelProxyUrl } from "@/lib/model-proxy"

type RawImageLike = {
  width: number
  height: number
  crop: (bounds: [number, number, number, number]) => Promise<RawImageLike>
}

type Classifier = (
  input: RawImageLike | RawImageLike[],
  options?: Record<string, unknown>,
) => Promise<ImageClassifierLabel[] | ImageClassifierLabel[][]>

type LoadedClassifier = {
  pipe: Classifier
  backend: "webgpu" | "wasm"
}

let primaryClassifier: LoadedClassifier | null = null
let secondaryClassifier: LoadedClassifier | null = null
let runtimeConfigured = false

async function prepareRuntime() {
  const { env, pipeline } = await import("@huggingface/transformers")
  if (!runtimeConfigured) {
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
    runtimeConfigured = true
  }
  return { pipeline }
}

function modelProgress(tier: "primary" | "secondary") {
  return (progress: { status?: string; progress?: number; file?: string }) => {
    self.postMessage({
      type: "progress",
      tier,
      stage: progress.status || "loading",
      progress: progress.progress || 0,
      file: progress.file,
    })
  }
}

async function loadPrimaryClassifier(preferWebGpu: boolean) {
  if (primaryClassifier) return primaryClassifier
  const { pipeline } = await prepareRuntime()
  const progress_callback = modelProgress("primary")

  if (preferWebGpu && "gpu" in navigator) {
    try {
      const pipe = await pipeline("image-classification", IMAGE_PIXEL_MODEL_ID, {
        device: "webgpu",
        dtype: "fp16",
        progress_callback,
        revision: IMAGE_PIXEL_MODEL_REVISION,
      }) as unknown as Classifier
      primaryClassifier = { pipe, backend: "webgpu" }
      return primaryClassifier
    } catch {
      primaryClassifier = null
    }
  }

  const pipe = await pipeline("image-classification", IMAGE_PIXEL_MODEL_ID, {
    device: "wasm",
    dtype: "q8",
    progress_callback,
    revision: IMAGE_PIXEL_MODEL_REVISION,
  }) as unknown as Classifier
  primaryClassifier = { pipe, backend: "wasm" }
  return primaryClassifier
}

async function loadSecondaryClassifier(preferWebGpu: boolean) {
  if (secondaryClassifier) return secondaryClassifier
  const { pipeline } = await prepareRuntime()
  const progress_callback = modelProgress("secondary")

  if (preferWebGpu && "gpu" in navigator) {
    try {
      const pipe = await pipeline("image-classification", IMAGE_PIXEL_SECONDARY_MODEL_ID, {
        device: "webgpu",
        dtype: "q4f16",
        progress_callback,
        revision: IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
      }) as unknown as Classifier
      secondaryClassifier = { pipe, backend: "webgpu" }
      return secondaryClassifier
    } catch {
      secondaryClassifier = null
    }
  }

  const pipe = await pipeline("image-classification", IMAGE_PIXEL_SECONDARY_MODEL_ID, {
    device: "wasm",
    dtype: "q8",
    progress_callback,
    revision: IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
  }) as unknown as Classifier
  secondaryClassifier = { pipe, backend: "wasm" }
  return secondaryClassifier
}

async function createViews(image: RawImageLike) {
  const plan = buildImageViewPlan(image.width, image.height)
  const views: RawImageLike[] = []
  const names: string[] = []
  for (const item of plan) {
    views.push(item.bounds ? await image.crop(item.bounds) : image)
    names.push(item.name)
  }
  return { views, names }
}

self.onmessage = async (event: MessageEvent<{
  type: "analyze"
  buffer: ArrayBuffer
  mime: string
  preferWebGpu: boolean
  allowSecondary: boolean
}>) => {
  if (event.data.type !== "analyze") return
  try {
    self.postMessage({ type: "status", tier: "primary", stage: "preparing-model" })
    const primary = await loadPrimaryClassifier(event.data.preferWebGpu)
    const { RawImage } = await import("@huggingface/transformers")
    self.postMessage({ type: "status", tier: "primary", stage: "decoding-image" })
    const image = await RawImage.fromBlob(
      new Blob([event.data.buffer], { type: event.data.mime }),
    ) as unknown as RawImageLike
    const { views, names } = await createViews(image)
    self.postMessage({
      type: "status",
      tier: "primary",
      stage: "analyzing-views",
      views: views.length,
    })
    const raw = await primary.pipe(views, { top_k: null })
    const outputs = Array.isArray(raw[0])
      ? raw as ImageClassifierLabel[][]
      : [raw as ImageClassifierLabel[]]
    const primaryResult = aggregateImageViews(
      outputs,
      names,
      primary.backend,
      IMAGE_PIXEL_DETECTOR_VERSION,
    )

    if (!event.data.allowSecondary || !shouldRunSecondaryPixelModel(primaryResult)) {
      self.postMessage({
        type: "result",
        result: combinePixelModelResults(
          primaryResult,
          null,
          event.data.allowSecondary ? "not-needed" : "skipped",
        ),
      })
      return
    }

    try {
      self.postMessage({ type: "status", tier: "secondary", stage: "preparing-model" })
      const secondary = await loadSecondaryClassifier(event.data.preferWebGpu)
      self.postMessage({
        type: "status",
        tier: "secondary",
        stage: "analyzing-secondary",
        views: 1,
      })
      const secondaryRaw = await secondary.pipe(image, { top_k: null })
      const secondaryOutputs = Array.isArray(secondaryRaw[0])
        ? secondaryRaw as ImageClassifierLabel[][]
        : [secondaryRaw as ImageClassifierLabel[]]
      const secondaryResult = aggregateImageViews(
        secondaryOutputs,
        ["full"],
        secondary.backend,
        IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
      )
      self.postMessage({
        type: "result",
        result: combinePixelModelResults(primaryResult, secondaryResult, "completed"),
      })
    } catch {
      self.postMessage({
        type: "result",
        result: combinePixelModelResults(primaryResult, null, "unavailable"),
      })
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Image model inference failed",
    })
  }
}

export {}
