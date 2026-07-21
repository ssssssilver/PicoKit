/// <reference lib="webworker" />

import {
  aggregateImageViews,
  buildImageViewPlan,
  combinePixelModelResults,
  combineTertiaryPixelModelResult,
  communityForensicsAiScore,
  IMAGE_PIXEL_DETECTOR_VERSION,
  IMAGE_PIXEL_MODEL_ID,
  IMAGE_PIXEL_MODEL_REVISION,
  IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
  IMAGE_PIXEL_SECONDARY_MODEL_ID,
  IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
  IMAGE_PIXEL_TERTIARY_DETECTOR_VERSION,
  IMAGE_PIXEL_TERTIARY_MODEL_ID,
  IMAGE_PIXEL_TERTIARY_MODEL_REVISION,
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

type CommunityForensicsProcessor = ((input: RawImageLike) => Promise<Record<string, unknown>>) & {
  do_center_crop: boolean
  crop_size: number
}

type CommunityForensicsModel = (
  inputs: Record<string, unknown>,
) => Promise<{ logits?: { data?: ArrayLike<number> } }>

type LoadedCommunityForensics = {
  processor: CommunityForensicsProcessor
  model: CommunityForensicsModel
  backend: "webgpu" | "wasm"
}

let primaryClassifier: LoadedClassifier | null = null
let secondaryClassifier: LoadedClassifier | null = null
let tertiaryClassifier: LoadedCommunityForensics | null = null
let runtimeConfigured = false

async function prepareRuntime() {
  const {
    AutoImageProcessor,
    AutoModelForImageClassification,
    env,
    pipeline,
  } = await import("@huggingface/transformers")
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
  return { AutoImageProcessor, AutoModelForImageClassification, pipeline }
}

function modelProgress(tier: "primary" | "secondary" | "tertiary") {
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

async function loadTertiaryClassifier(preferWebGpu: boolean) {
  if (tertiaryClassifier) return tertiaryClassifier
  const { AutoImageProcessor, AutoModelForImageClassification } = await prepareRuntime()
  const progress_callback = modelProgress("tertiary")
  const processor = await AutoImageProcessor.from_pretrained(
    IMAGE_PIXEL_TERTIARY_MODEL_ID,
    {
      progress_callback,
      revision: IMAGE_PIXEL_TERTIARY_MODEL_REVISION,
    },
  ) as unknown as CommunityForensicsProcessor
  // The published preprocessor metadata specifies resize=440 and crop=384,
  // but omits this flag. Without the override the ViT receives 440px tokens
  // and fails because its positional embeddings are fixed to 384px.
  processor.do_center_crop = true
  processor.crop_size = 384

  async function loadModel(
    backend: "webgpu" | "wasm",
    dtype: "q4f16" | "q8",
  ) {
    const model = await AutoModelForImageClassification.from_pretrained(
      IMAGE_PIXEL_TERTIARY_MODEL_ID,
      {
        device: backend,
        dtype,
        progress_callback,
        revision: IMAGE_PIXEL_TERTIARY_MODEL_REVISION,
      },
    ) as unknown as CommunityForensicsModel
    tertiaryClassifier = { processor, model, backend }
    return tertiaryClassifier
  }

  if (preferWebGpu && "gpu" in navigator) {
    try {
      return await loadModel("webgpu", "q4f16")
    } catch {
      tertiaryClassifier = null
    }
  }
  return loadModel("wasm", "q8")
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
  allowCascade: boolean
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

    if (!event.data.allowCascade) {
      self.postMessage({
        type: "result",
        result: combinePixelModelResults(primaryResult, null, "skipped"),
      })
      return
    }

    let secondaryResult = null
    let secondaryState: "completed" | "unavailable" = "unavailable"
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
      secondaryResult = aggregateImageViews(
        secondaryOutputs,
        ["full"],
        secondary.backend,
        IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
      )
      secondaryState = "completed"
    } catch {
      secondaryResult = null
    }

    const firstTwo = combinePixelModelResults(
      primaryResult,
      secondaryResult,
      secondaryState,
    )
    try {
      self.postMessage({ type: "status", tier: "tertiary", stage: "preparing-model" })
      const tertiary = await loadTertiaryClassifier(event.data.preferWebGpu)
      self.postMessage({
        type: "status",
        tier: "tertiary",
        stage: "analyzing-tertiary",
        views: 1,
      })
      const inputs = await tertiary.processor(image)
      const output = await tertiary.model(inputs)
      const score = communityForensicsAiScore(output.logits?.data ?? [])
      const tertiaryResult = aggregateImageViews(
        [[
          { label: "real", score: 1 - score },
          { label: "fake", score },
        ]],
        ["full"],
        tertiary.backend,
        IMAGE_PIXEL_TERTIARY_DETECTOR_VERSION,
      )
      self.postMessage({
        type: "result",
        result: combineTertiaryPixelModelResult(firstTwo, tertiaryResult, "completed"),
      })
    } catch {
      self.postMessage({
        type: "result",
        result: combineTertiaryPixelModelResult(firstTwo, null, "unavailable"),
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
