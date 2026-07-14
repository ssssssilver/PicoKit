"use client"

import { AlertTriangle, Download, LoaderCircle, Scissors, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { ImageCompare } from "@/components/image-compare"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { downloadBlob } from "@/lib/image-sanitizer"

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
  error?: string
}

type Result = { blob: Blob; width: number; height: number; backend: string; model: string }

export function BackgroundRemoverTool() {
  const { language, pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [resultUrl, setResultUrl] = useState("")
  const workerRef = useRef<Worker | null>(null)
  const sourceUrlRef = useRef("")
  const resultUrlRef = useRef("")

  useEffect(() => () => {
    workerRef.current?.terminate()
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  function handleFile(next: File | null) {
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
  }

  async function removeBackground() {
    if (!file) return
    workerRef.current?.terminate()
    const worker = new Worker(new URL("../workers/background-removal.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    setRunning(true)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ""
    setResultUrl("")
    setResult(null)
    setError("")
    setProgress(1)
    setStatus(pick("正在准备本地抠图", "Preparing local background removal"))

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (message.type === "progress") {
        setProgress(Math.max(2, Math.min(95, Number(message.progress) || 2)))
        setStatus(pick("正在准备首次使用所需组件", "Preparing for first use"))
      }
      if (message.type === "status") {
        setStatus(localizeStage(message.stage, language))
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
          model: message.model || "Xenova/modnet",
        })
        setProgress(100)
        setStatus(pick("背景移除完成", "Background removed"))
        setRunning(false)
        workerRef.current = null
        worker.terminate()
      }
      if (message.type === "error") {
        setError(language === "en" ? "Background removal failed. Try a portrait with a clear foreground or use a smaller image." : `背景移除失败：${message.error || "请换一张较小的人像图片重试"}`)
        setRunning(false)
        workerRef.current = null
        worker.terminate()
      }
    }
    worker.onerror = () => {
      setError(pick("本地抠图 Worker 启动失败，请刷新后重试。", "The local background-removal worker failed to start. Refresh and try again."))
      setRunning(false)
      workerRef.current = null
      worker.terminate()
    }

    try {
      const buffer = await file.arrayBuffer()
      const nav = navigator as Navigator & { gpu?: unknown }
      worker.postMessage({ type: "process", buffer, mime: file.type, preferWebGpu: Boolean(nav.gpu) }, [buffer])
    } catch {
      setError(pick("无法读取图片文件。", "Unable to read the image file."))
      setRunning(false)
      workerRef.current = null
      worker.terminate()
    }
  }

  function cancel() {
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(false)
    setProgress(0)
    setStatus(pick("已取消", "Cancelled"))
  }

  return (
    <div className="space-y-6">
      <Card className="border-cyan-300/20 bg-cyan-300/[.035] shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base text-zinc-100">{pick("最佳使用场景", "Best use cases")}</CardTitle></CardHeader>
        <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-cyan-300">{pick("推荐使用", "Recommended")}</p>
            <ul className="mt-3 space-y-2 leading-6 text-zinc-400">
              <li>• {pick("单人半身照、头像或全身人像", "Single-person headshots, half-body, or full-body portraits")}</li>
              <li>• {pick("人物主体完整、轮廓清晰，背景与人物有明显区分", "A complete, clearly outlined person with good foreground-background separation")}</li>
              <li>• {pick("需要保留发丝、衣物柔边和自然透明过渡", "Portraits where hair, soft clothing edges, and natural alpha transitions matter")}</li>
              <li>• {pick("社交头像、简历照片、海报人物素材和封面合成", "Profile images, résumé photos, poster subjects, and cover composites")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-amber-300">{pick("不建议使用", "Not recommended")}</p>
            <ul className="mt-3 space-y-2 leading-6 text-zinc-400">
              <li>• {pick("商品、动物、车辆、建筑和纯风景图片", "Products, animals, vehicles, buildings, or landscape-only images")}</li>
              <li>• {pick("多人重叠、主体被大面积遮挡或人物太小", "Overlapping groups, heavily occluded subjects, or very small people")}</li>
              <li>• {pick("玻璃、薄纱、烟雾等复杂透明材质", "Complex transparent materials such as glass, veils, or smoke")}</li>
              <li>• {pick("背景与头发或衣服颜色非常接近的低对比照片", "Low-contrast photos where the background closely matches hair or clothing")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <FileDropzone file={file} onFile={handleFile} disabled={running} maxBytes={15 * 1024 * 1024} />
          {file ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={removeBackground} disabled={running}>
                {running ? <LoaderCircle className="animate-spin" /> : <Scissors />}
                {running ? pick("正在本地抠图", "Removing locally") : pick("一键移除背景", "Remove background")}
              </Button>
              {running ? <Button size="lg" variant="outline" onClick={cancel}><X />{pick("取消", "Cancel")}</Button> : null}
              <p className="text-xs text-zinc-500">{pick("首次准备可能稍慢，完成后会复用浏览器缓存。", "First-time setup may take longer; the browser will reuse its cache afterward.")}</p>
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
            <Badge variant="secondary">{result.backend.toUpperCase()}</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <ImageCompare before={sourceUrl} after={resultUrl} beforeLabel="原图" afterLabel="透明结果" beforeLabelEn="Original" afterLabelEn="Transparent result" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label={pick("输出尺寸", "Output size")} value={`${result.width} × ${result.height}`} />
              <Info label={pick("PNG 大小", "PNG size")} value={formatBytes(result.blob.size)} />
              <Info label={pick("处理位置", "Processing location")} value={pick("当前设备", "This device")} />
            </div>
            <Button size="lg" onClick={() => downloadBlob(result.blob, `${file.name.replace(/\.[^.]+$/, "")}-removebg-picokit.png`)}><Download />{pick("下载透明 PNG", "Download transparent PNG")}</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function localizeStage(stage: string | undefined, language: "zh-CN" | "en") {
  const stages: Record<string, [string, string]> = {
    "loading-model": ["正在准备人像抠图", "Preparing portrait background removal"],
    "removing-background": ["正在计算前景透明度", "Computing the foreground alpha matte"],
    "encoding-png": ["正在生成透明 PNG", "Encoding the transparent PNG"],
  }
  const value = stages[stage || ""] ?? ["正在处理", "Processing"]
  return language === "en" ? value[1] : value[0]
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[.025] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium text-zinc-100">{value}</p></div>
}
