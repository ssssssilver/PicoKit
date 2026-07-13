/// <reference lib="webworker" />

const MODEL_ID = "Xenova/modnet"

type BackgroundResult = {
  width: number
  height: number
  toBlob: (type?: string, quality?: number) => Promise<Blob>
}

type BackgroundRemover = (input: Blob) => Promise<BackgroundResult>

let remover: BackgroundRemover | null = null
let activeBackend = "wasm"

async function loadRemover(preferWebGpu: boolean) {
  if (remover) return remover
  const { env, pipeline } = await import("@huggingface/transformers")
  env.allowLocalModels = false
  env.useBrowserCache = true

  const progress_callback = (progress: { status?: string; progress?: number; file?: string }) => {
    self.postMessage({
      type: "progress",
      stage: progress.status || "loading",
      progress: progress.progress || 0,
      file: progress.file,
    })
  }

  if (preferWebGpu && "gpu" in self.navigator) {
    try {
      activeBackend = "webgpu"
      remover = await pipeline("background-removal", MODEL_ID, {
        device: "webgpu",
        dtype: "fp16",
        progress_callback,
      }) as unknown as BackgroundRemover
      return remover
    } catch {
      remover = null
    }
  }

  activeBackend = "wasm"
  remover = await pipeline("background-removal", MODEL_ID, {
    device: "wasm",
    dtype: "q8",
    progress_callback,
  }) as unknown as BackgroundRemover
  return remover
}

self.onmessage = async (event: MessageEvent<{ type: "process"; buffer: ArrayBuffer; mime: string; preferWebGpu: boolean }>) => {
  if (event.data.type !== "process") return
  try {
    self.postMessage({ type: "status", stage: "loading-model" })
    const segmenter = await loadRemover(event.data.preferWebGpu)
    self.postMessage({ type: "status", stage: "removing-background" })
    const source = new Blob([event.data.buffer], { type: event.data.mime })
    const output = await segmenter(source)
    self.postMessage({ type: "status", stage: "encoding-png" })
    const png = await output.toBlob("image/png")
    const buffer = await png.arrayBuffer()
    self.postMessage({
      type: "result",
      buffer,
      width: output.width,
      height: output.height,
      backend: activeBackend,
      model: MODEL_ID,
    }, [buffer])
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : "Background removal failed" })
  }
}

export {}
