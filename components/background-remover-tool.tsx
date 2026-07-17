"use client"

import { AlertTriangle, ArrowRight, Download, LoaderCircle, Scissors, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { BackgroundMaskEditor } from "@/components/background-mask-editor"
import { ImageCompare } from "@/components/image-compare"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { downloadBlob } from "@/lib/image-sanitizer"
import {
  backgroundModelCacheUrl,
  backgroundRemovalOutputName,
  canRefineBackground,
} from "@/lib/background-removal"
import { IMAGE_EDITOR_MAX_BYTES, IMAGE_EDITOR_MAX_PIXELS } from "@/lib/image-editor"
import { saveLocalAsset } from "@/lib/local-asset-transfer"

type WorkerMessage = {
  type: "progress" | "status" | "result" | "error"
  progress?: number
  file?: string
  stage?: string
  buffer?: ArrayBuffer
  width?: number
  height?: number
  backend?: string
  model?: string
  revision?: string
  code?: string
  error?: string
}

type Result = { blob: Blob; width: number; height: number; backend: string }

const BACKGROUND_REMOVER_MAX_BYTES = 15 * 1024 * 1024
const BACKGROUND_REMOVER_MAX_PIXELS = IMAGE_EDITOR_MAX_PIXELS

async function inspectModelCache(): Promise<boolean | null> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return null
  }

  try {
    return Boolean(await window.caches.match(backgroundModelCacheUrl()))
  } catch {
    return null
  }
}

export function BackgroundRemoverTool() {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [handoff, setHandoff] = useState<"editor" | "optimizer" | "">("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [resultUrl, setResultUrl] = useState("")
  const [modelCached, setModelCached] = useState<boolean | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const operationRef = useRef(0)
  const sourceUrlRef = useRef("")
  const resultUrlRef = useRef("")

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void inspectModelCache().then((cacheState) => {
        if (active) setModelCached(cacheState)
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => () => {
    operationRef.current += 1
    workerRef.current?.terminate()
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  function handleFile(next: File | null) {
    operationRef.current += 1
    workerRef.current?.terminate()
    workerRef.current = null
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    sourceUrlRef.current = next ? URL.createObjectURL(next) : ""
    resultUrlRef.current = ""
    setSourceUrl(sourceUrlRef.current)
    setResultUrl("")
    setFile(next)
    setResult(null)
    setRunning(false)
    setProgress(0)
    setStatus("")
    setError("")
    setHandoff("")
  }

  async function removeBackground() {
    if (!file) return
    const operation = operationRef.current + 1
    operationRef.current = operation
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(true)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ""
    setResultUrl("")
    setResult(null)
    setError("")
    setProgress(1)
    setStatus(pick("正在准备本地去背景", "Preparing on-device background removal"))

    let worker: Worker
    try {
      worker = new Worker(new URL("../workers/background-removal.worker.ts", import.meta.url), { type: "module" })
      workerRef.current = worker
    } catch {
      setError(pick("当前浏览器无法启动本地抠图，请刷新页面或更换浏览器后重试。", "This browser could not start local background removal. Refresh the page or try another browser."))
      setRunning(false)
      setProgress(0)
      return
    }

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (operationRef.current !== operation) return
      const message = event.data
      if (message.type === "progress") {
        setProgress(Math.max(2, Math.min(95, Number(message.progress) || 2)))
        setStatus(pick("正在准备本地处理能力，首次使用可能需要几秒", "Preparing on-device processing; first-time setup may take a few seconds"))
      }
      if (message.type === "status") {
        setStatus(localizeStage(message.stage, pick))
        if (message.stage === "removing-background") setProgress((value) => Math.max(value, 96))
        if (message.stage === "encoding-png") setProgress(99)
      }
      if (message.type === "result" && message.buffer) {
        const blob = new Blob([message.buffer], { type: "image/png" })
        resultUrlRef.current = URL.createObjectURL(blob)
        setResultUrl(resultUrlRef.current)
        setResult({
          blob,
          width: message.width || 0,
          height: message.height || 0,
          backend: message.backend || "wasm",
        })
        setProgress(100)
        setStatus(pick("背景移除完成", "Background removal complete"))
        setRunning(false)
        workerRef.current = null
        worker.terminate()
        void inspectModelCache().then(setModelCached)
      }
      if (message.type === "error") {
        setError(backgroundRemovalError(message.code, pick))
        setRunning(false)
        workerRef.current = null
        worker.terminate()
      }
    }
    worker.onerror = () => {
      if (operationRef.current !== operation) return
      setError(pick("本地处理未能启动，请刷新页面或更换浏览器后重试。", "Local processing could not start. Refresh the page or try another browser."))
      setRunning(false)
      workerRef.current = null
      worker.terminate()
    }

    try {
      const buffer = await file.arrayBuffer()
      if (operationRef.current !== operation || workerRef.current !== worker) return
      const nav = navigator as Navigator & { gpu?: unknown }
      worker.postMessage({ type: "process", buffer, mime: file.type, preferWebGpu: Boolean(nav.gpu) }, [buffer])
    } catch {
      if (operationRef.current !== operation) return
      setError(pick("无法读取图片文件。", "Unable to read the image file."))
      setRunning(false)
      workerRef.current = null
      worker.terminate()
    }
  }

  function cancel() {
    operationRef.current += 1
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(false)
    setProgress(0)
    setStatus(pick("已取消", "Cancelled"))
  }

  async function continueWith(destination: "editor" | "optimizer") {
    if (!result || !file) return
    setHandoff(destination)
    setError("")
    try {
      const outputName = backgroundRemovalOutputName(file.name)
      const assetId = await saveLocalAsset(result.blob, outputName, "background-remover")
      const pathname = destination === "editor" ? "/image-editor" : "/image-compressor"
      window.location.assign(`${pathname}?asset=${encodeURIComponent(assetId)}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : pick("无法将图片发送到下一步。", "Unable to pass the image to the next step."))
      setHandoff("")
    }
  }

  function applyRefinement(blob: Blob) {
    if (!result) return
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = URL.createObjectURL(blob)
    setResultUrl(resultUrlRef.current)
    setResult({ ...result, blob })
    setError("")
  }

  return (
    <div className="space-y-6">
      <Card className="border-cyan-300/20 bg-cyan-300/[.035] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-100">{pick("一键移除背景", "Remove background")}</CardTitle>
          <p className="text-sm leading-6 text-zinc-500">{pick("自动识别图片主体并生成透明背景，处理全程在当前设备完成。", "Automatically detect the main subject and create a transparent background, entirely on this device.")}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <Badge variant="outline">{pick("本地处理", "On-device")}</Badge>
          <Badge variant="outline">WebGPU / WASM</Badge>
          <Badge variant="outline">{modelCacheLabel(modelCached, pick)}</Badge>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base text-zinc-100">{pick("最佳使用场景", "Best use cases")}</CardTitle></CardHeader>
        <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-cyan-300">{pick("推荐使用", "Recommended")}</p>
            <ul className="mt-3 space-y-2 leading-6 text-zinc-400">
              <li>• {pick("头像、半身照、全身人物和多人合照", "Headshots, half-body and full-body portraits, and group photos")}</li>
              <li>• {pick("商品、宠物、车辆、家具、植物和图标素材", "Products, pets, vehicles, furniture, plants, and icon assets")}</li>
              <li>• {pick("主体占画面较大，轮廓清晰且与背景有明显区分", "Large, clearly outlined subjects with good foreground-background separation")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-amber-300">{pick("需要手动修正的场景", "Scenes that may need refinement")}</p>
            <ul className="mt-3 space-y-2 leading-6 text-zinc-400">
              <li>• {pick("玻璃、薄纱、烟雾和半透明塑料", "Glass, veils, smoke, and translucent plastic")}</li>
              <li>• {pick("主体很小、严重遮挡、运动模糊或低对比边缘", "Very small, heavily occluded, motion-blurred, or low-contrast subjects")}</li>
              <li>• {pick("细发丝、细辐条、绳索、孔洞和复杂反光可能需要手动修边", "Fine hair, spokes, cords, holes, and complex reflections may need manual edge refinement")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <FileDropzone
            file={file}
            onFile={handleFile}
            disabled={running}
            maxBytes={BACKGROUND_REMOVER_MAX_BYTES}
            maxPixels={BACKGROUND_REMOVER_MAX_PIXELS}
          />
          {file && sourceUrl ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-white/[.025]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-100">{pick("原图预览", "Original preview")}</p>
                <p className="max-w-full truncate text-xs text-zinc-500">{file.name} · {formatBytes(file.size)}</p>
              </div>
              <div className="grid min-h-48 place-items-center bg-black/20 p-3">
                {/* Blob URLs are local previews and cannot be optimized by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt={pick("等待移除背景的原图预览", "Preview of the original image before background removal")} className="block max-h-[420px] max-w-full rounded-lg object-contain" />
              </div>
            </div>
          ) : null}
          {file ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={removeBackground} disabled={running}>
                {running ? <LoaderCircle className="animate-spin" /> : <Scissors />}
                {running
                  ? pick("正在本地去背景", "Removing the background locally")
                  : pick("一键移除背景", "Remove background")}
              </Button>
              {running ? <Button size="lg" variant="outline" onClick={cancel}><X />{pick("取消", "Cancel")}</Button> : null}
              <p className="text-xs text-zinc-500">{pick("首次使用会准备约 4.6 MB 的本地处理能力，优先使用 GPU，不可用时自动切换到本机 CPU；之后会复用浏览器缓存。", "The first run prepares about 4.6 MB of on-device processing resources, prefers the GPU, and automatically uses this device's CPU when needed; the browser reuses its cache afterward.")}</p>
            </div>
          ) : null}
          {running ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-4 text-xs text-zinc-500"><span>{status}</span><span>{Math.round(progress)}%</span></div>
              <Progress value={progress} />
            </div>
          ) : null}
          {error ? <Alert variant="destructive" className="mt-5"><AlertTriangle /><AlertTitle>{pick("无法移除背景", "Unable to remove background")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>

      {result && sourceUrl && resultUrl && file ? (
        <Card className="overflow-hidden border-white/10 bg-[#111] shadow-none">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div><CardTitle className="text-base text-zinc-100">{pick("透明背景结果", "Transparent background result")}</CardTitle><p className="mt-1 text-sm text-zinc-500">{pick("拖动滑块比较原图和透明 PNG。", "Drag the slider to compare the original and transparent PNG.")}</p></div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline">{pick("本地去背景", "On-device removal")}</Badge>
              <Badge variant="secondary">{result.backend.toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ImageCompare before={sourceUrl} after={resultUrl} beforeLabel="原图" afterLabel="透明结果" beforeLabelEn="Original" afterLabelEn="Transparent result" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label={pick("输出尺寸", "Output size")} value={`${result.width} × ${result.height}`} />
              <Info label={pick("PNG 大小", "PNG size")} value={formatBytes(result.blob.size)} />
              <Info label={pick("处理位置", "Processing location")} value={pick("当前设备", "This device")} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => downloadBlob(result.blob, backgroundRemovalOutputName(file.name))}><Download />{pick("下载透明 PNG", "Download transparent PNG")}</Button>
              <Button size="lg" variant="outline" disabled={Boolean(handoff) || result.blob.size > IMAGE_EDITOR_MAX_BYTES} onClick={() => void continueWith("editor")}>
                {handoff === "editor" ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{pick("继续快速修图", "Continue editing")}
              </Button>
              <Button size="lg" variant="outline" disabled={Boolean(handoff)} onClick={() => void continueWith("optimizer")}>
                {handoff === "optimizer" ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{pick("继续压缩交付", "Continue to optimize")}
              </Button>
            </div>
            {result.blob.size > IMAGE_EDITOR_MAX_BYTES ? <p className="text-xs leading-5 text-amber-300">{pick("透明 PNG 较大，暂不适合直接进入快速修图；可以先进入批量优化缩小文件。", "This transparent PNG is too large for the quick editor. Optimize it first to reduce the file size.")}</p> : null}
            <p className="text-xs leading-5 text-zinc-500">{pick("下一步会通过当前浏览器的临时存储读取结果，不会上传文件。临时图片会在两小时后失效，并在本页面保持打开时或下次使用网站时清理。", "The next tool reads the result from temporary storage in this browser. Nothing is uploaded. The temporary image expires after two hours and is removed while this page remains open or the next time the site is used.")}</p>
          </CardContent>
        </Card>
      ) : null}

      {result && file && canRefineBackground(result.width, result.height) ? (
        <BackgroundMaskEditor key={resultUrl} source={file} result={result.blob} onApply={applyRefinement} />
      ) : null}
      {result && !canRefineBackground(result.width, result.height) ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{pick("图片尺寸较大", "Large image")}</AlertTitle>
          <AlertDescription>{pick(
            "透明 PNG 可以正常下载，但当前尺寸不适合在同一标签页继续修边。请先进入图片优化缩小尺寸。",
            "The transparent PNG is ready to download, but this image is too large for edge refinement in the same tab. Optimize its dimensions first.",
          )}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

function localizeStage(stage: string | undefined, pick: (zh: string, en: string) => string) {
  const stages: Record<string, { zh: string; en: string }> = {
    "loading-background-model": { zh: "正在准备本地去背景", en: "Preparing on-device background removal" },
    "removing-background": { zh: "正在识别主体与背景边界", en: "Finding the subject and background boundary" },
    "encoding-png": { zh: "正在生成透明 PNG", en: "Encoding the transparent PNG" },
  }
  const value = stages[stage || ""] ?? { zh: "正在处理", en: "Processing" }
  return pick(value.zh, value.en)
}

function modelCacheLabel(cached: boolean | null, pick: (zh: string, en: string) => string) {
  if (cached === true) return pick("已在浏览器缓存", "Cached in this browser")
  if (cached === false) return pick("首次使用时按需准备", "Prepared on first use")
  return pick("按需准备", "Prepared on demand")
}

function backgroundRemovalError(code: string | undefined, pick: (zh: string, en: string) => string) {
  if (code === "general-model-integrity-failed") return pick(
    "本地处理组件校验失败，已停止运行以避免使用不完整文件。请清理该网站的缓存后重试。",
    "The local processing component failed verification, so processing stopped instead of using an incomplete file. Clear this site's cache and try again.",
  )
  if (code === "general-model-load-failed") return pick(
    "本地去背景能力未能准备完成。请检查网络后重试；无需 GPU，也可以使用本机 CPU。",
    "On-device background removal could not be prepared. Check your connection and try again; a GPU is not required because this device's CPU can also be used.",
  )
  return pick(
    "当前浏览器未能完成本地处理。请刷新后重试；系统会自动在 GPU 与 CPU 之间选择可用方式。",
    "This browser could not complete local processing. Refresh and try again; the tool automatically chooses an available GPU or CPU path.",
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[.025] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium text-zinc-100">{value}</p></div>
}
