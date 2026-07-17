/// <reference lib="webworker" />

import { aiScore, normalizeOutput, splitText, type PipelineOutput } from "@/lib/text-detector-core"
import { toModelProxyUrl } from "@/lib/model-proxy"

const MODEL_ID = "onnx-community/tmr-ai-text-detector-ONNX"

type Classifier = (input: string | string[], options?: Record<string, unknown>) => Promise<PipelineOutput>

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
      classifier = await pipeline("text-classification", MODEL_ID, { device: "webgpu", dtype: "fp16", progress_callback }) as unknown as Classifier
      return classifier
    } catch {
      classifier = null
    }
  }
  activeBackend = "wasm"
  classifier = await pipeline("text-classification", MODEL_ID, { device: "wasm", dtype: "q8", progress_callback }) as unknown as Classifier
  return classifier
}

self.onmessage = async (event: MessageEvent<{ type: "analyze"; text: string; preferWebGpu: boolean }>) => {
  if (event.data.type !== "analyze") return
  const text = event.data.text.trim()
  if (text.length < 300) {
    self.postMessage({ type: "error", error: "至少输入约 300 个字符，短文本误差过大。" })
    return
  }
  try {
    self.postMessage({ type: "status", stage: "正在准备本地模型" })
    const pipe = await loadClassifier(event.data.preferWebGpu)
    const chunks = splitText(text)
    self.postMessage({ type: "status", stage: `正在分析 ${chunks.length} 个文本片段` })
    const raw = await pipe(chunks, { top_k: null, truncation: true })
    const normalized = normalizeOutput(raw, chunks.length)
    const segments = chunks.map((chunk, index) => ({
      excerpt: chunk.slice(0, 180).replace(/\s+/g, " "),
      score: aiScore(normalized[index] || []),
      characters: chunk.length,
    }))
    const total = segments.reduce((sum, item) => sum + item.characters, 0)
    const score = segments.reduce((sum, item) => sum + item.score * item.characters, 0) / total
    const variance = segments.reduce((sum, item) => sum + (item.score - score) ** 2, 0) / Math.max(1, segments.length)
    const confidence = Math.max(0.25, Math.min(0.92, 0.88 - Math.sqrt(variance) * 0.8 + Math.min(text.length / 12000, 0.08)))
    self.postMessage({
      type: "result",
      result: {
        score,
        confidence,
        backend: activeBackend,
        model: MODEL_ID,
        segments,
        band: score >= 0.72 ? "较高 AI 风险" : score >= 0.42 ? "不确定/混合" : "较低 AI 风险",
      },
    })
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : "模型运行失败" })
  }
}

export {}
