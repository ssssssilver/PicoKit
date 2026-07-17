"use client"

import { AlertTriangle, CheckCircle2, Download, LoaderCircle, MousePointer2, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { FileDropzone } from "@/components/file-dropzone"
import { ImageCompare } from "@/components/image-compare"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { downloadBlob } from "@/lib/image-sanitizer"
import {
  clampRect,
  cloneFillRegion,
  detectTextWatermark,
  normalizeDragRect,
  type PixelRect,
  type VisibleWatermarkProvider,
} from "@/lib/visible-watermark"

type Mode = "auto" | "gemini" | "doubao" | "jimeng" | "manual"

type ResultMeta = {
  applied: boolean
  provider: "gemini" | VisibleWatermarkProvider | "manual" | "unknown"
  confidence: number | null
  region: PixelRect | null
  message: { zh: string; en: string }
}

type GeminiMeta = {
  applied: boolean
  skipReason: string | null
  detection?: { adaptiveConfidence?: number | null }
}

async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("image-decode-failed"))
    image.src = url
  })
}

function imageCanvas(image: HTMLImageElement) {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  canvas.getContext("2d", { willReadFrequently: true })?.drawImage(image, 0, 0)
  return canvas
}

async function canvasBlob(canvas: HTMLCanvasElement | OffscreenCanvas) {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: "image/png" })
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("result-encode-failed")), "image/png"))
}

function providerName(provider: ResultMeta["provider"], pick: (zh: string, en: string) => string) {
  const names = {
    gemini: { zh: "Gemini", en: "Gemini" },
    doubao: { zh: "豆包", en: "Doubao" },
    jimeng: { zh: "即梦", en: "Jimeng" },
    manual: { zh: "手动框选", en: "Manual selection" },
    unknown: { zh: "未识别", en: "Not identified" },
  }
  return pick(names[provider].zh, names[provider].en)
}

export function GeminiWatermarkTool() {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState("")
  const [resultUrl, setResultUrl] = useState("")
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [meta, setMeta] = useState<ResultMeta | null>(null)
  const [mode, setMode] = useState<Mode>("auto")
  const [selection, setSelection] = useState<PixelRect | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const urlsRef = useRef<string[]>([])
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null)
  const selectionImageRef = useRef<HTMLImageElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => () => { urlsRef.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  useEffect(() => {
    if (!sourceUrl || mode !== "manual") return
    let cancelled = false
    loadImage(sourceUrl).then((image) => {
      if (cancelled) return
      selectionImageRef.current = image
      drawSelection(image, selectionCanvasRef.current, null)
    }).catch(() => setError(pick("浏览器无法读取这张图片。", "The browser could not read this image.")))
    return () => { cancelled = true }
  }, [mode, pick, sourceUrl])

  useEffect(() => {
    if (mode !== "manual" || !selectionImageRef.current) return
    drawSelection(selectionImageRef.current, selectionCanvasRef.current, selection)
  }, [mode, selection])

  function handleFile(next: File | null) {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    const nextUrl = next ? URL.createObjectURL(next) : ""
    if (nextUrl) urlsRef.current.push(nextUrl)
    setFile(next)
    setSourceUrl(nextUrl)
    setResultUrl("")
    setResultBlob(null)
    setMeta(null)
    setSelection(null)
    setError("")
    setConfirmed(false)
  }

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()
    return {
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * canvas.width),
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * canvas.height),
    }
  }

  function beginSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointerPosition(event)
    dragStartRef.current = point
    setSelection({ x: point.x, y: point.y, width: 1, height: 1 })
  }

  function moveSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragStartRef.current) return
    const point = pointerPosition(event)
    const canvas = event.currentTarget
    setSelection(clampRect(normalizeDragRect(dragStartRef.current.x, dragStartRef.current.y, point.x, point.y), canvas.width, canvas.height))
  }

  function endSelection() {
    dragStartRef.current = null
  }

  async function applyTextProvider(canvas: HTMLCanvasElement, provider: VisibleWatermarkProvider) {
    const detection = await detectTextWatermark(canvas, provider)
    if (!detection.detected) {
      return {
        canvas,
        meta: {
          applied: false,
          provider: "unknown",
          confidence: detection.confidence,
          region: detection.region,
          message: {
            zh: `没有可靠识别到${provider === "doubao" ? "豆包" : "即梦"}角标，图片未被修改。可改用手动框选。`,
            en: `No reliable ${provider === "doubao" ? "Doubao" : "Jimeng"} mark was found. The image was not changed; try manual selection.`,
          },
        } satisfies ResultMeta,
      }
    }
    cloneFillRegion(canvas, detection.region)
    return {
      canvas,
      meta: {
        applied: true,
        provider,
        confidence: detection.confidence,
        region: detection.region,
        message: {
          zh: "已在本地定位可见文字角标并修复对应区域。请放大检查复杂纹理。",
          en: "The visible text mark was located and repaired locally. Zoom in to check complex textures.",
        },
      } satisfies ResultMeta,
    }
  }

  async function applyGemini(image: HTMLImageElement) {
    const { removeWatermarkFromImage } = await import("@pilio/gemini-watermark-remover/browser")
    const result = await removeWatermarkFromImage(image, { adaptiveMode: "auto" })
    const geminiMeta = result.meta as GeminiMeta
    return {
      canvas: result.canvas as HTMLCanvasElement | OffscreenCanvas,
      meta: {
        applied: geminiMeta.applied,
        provider: geminiMeta.applied ? "gemini" : "unknown",
        confidence: geminiMeta.detection?.adaptiveConfidence ?? null,
        region: null,
        message: geminiMeta.applied
          ? { zh: "已使用 Gemini 专用反向混合算法完成本地处理。", en: "Local processing completed with the Gemini-specific reverse-blending method." }
          : { zh: "没有可靠识别到支持的 Gemini 角标，图片未被修改。可选择其他平台或手动框选。", en: "No supported Gemini mark was reliably detected. Try another provider or manual selection." },
      } satisfies ResultMeta,
    }
  }

  async function processImage() {
    if (!file || !sourceUrl || !confirmed) return
    if (mode === "manual" && (!selection || selection.width < 6 || selection.height < 6)) {
      setError(pick("请先在图片上拖动框选需要处理的角标区域。", "Drag on the image to select the mark first."))
      return
    }
    setRunning(true)
    setError("")
    try {
      const image = await loadImage(sourceUrl)
      let outcome: { canvas: HTMLCanvasElement | OffscreenCanvas; meta: ResultMeta }
      if (mode === "manual") {
        const canvas = imageCanvas(image)
        cloneFillRegion(canvas, selection as PixelRect)
        outcome = {
          canvas,
          meta: {
            applied: true,
            provider: "manual",
            confidence: null,
            region: selection,
            message: { zh: "已使用附近像素在本地修复框选区域。请检查边缘与纹理是否自然。", en: "The selected area was repaired locally with nearby pixels. Check edges and textures before using the result." },
          },
        }
      } else if (mode === "gemini") {
        outcome = await applyGemini(image)
      } else if (mode === "doubao" || mode === "jimeng") {
        outcome = await applyTextProvider(imageCanvas(image), mode)
      } else {
        const base = imageCanvas(image)
        const detections = await Promise.all([detectTextWatermark(base, "doubao"), detectTextWatermark(base, "jimeng")])
        const best = detections.filter((item) => item.detected).sort((a, b) => b.confidence - a.confidence)[0]
        outcome = best ? await applyTextProvider(base, best.provider) : await applyGemini(image)
      }

      const blob = await canvasBlob(outcome.canvas)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      const nextResultUrl = URL.createObjectURL(blob)
      urlsRef.current.push(nextResultUrl)
      setResultBlob(blob)
      setResultUrl(nextResultUrl)
      setMeta(outcome.meta)
    } catch (reason) {
      const key = reason instanceof Error ? reason.message : ""
      if (key === "selection-too-large") setError(pick("框选区域过大，附近没有足够像素用于修复。请缩小选区。", "The selection is too large to repair from nearby pixels. Choose a smaller area."))
      else setError(pick("本地处理未能完成。请确认图片格式正常，刷新后重试或使用手动框选。", "Local processing could not finish. Confirm the image is valid, refresh, or try manual selection."))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-[#0c0d0e] shadow-none">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <FileDropzone file={file} onFile={handleFile} disabled={running} />
          {file ? <>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{pick("选择识别方式", "Choose detection mode")}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{pick("自动识别会比较豆包与即梦特征，再检查 Gemini；不确定时不会修改图片。", "Auto mode compares Doubao and Jimeng features, then checks Gemini, and leaves the image unchanged when uncertain.")}</p>
              </div>
              <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); setMeta(null); setResultUrl(""); setResultBlob(null); setError("") }}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/40 p-1 sm:grid-cols-5">
                  <TabsTrigger value="auto" className="h-9 px-3 data-active:bg-cyan-300 data-active:text-black">{pick("自动识别", "Auto")}</TabsTrigger>
                  <TabsTrigger value="gemini" className="h-9 px-3 data-active:bg-cyan-300 data-active:text-black">Gemini</TabsTrigger>
                  <TabsTrigger value="doubao" className="h-9 px-3 data-active:bg-cyan-300 data-active:text-black">{pick("豆包", "Doubao")}</TabsTrigger>
                  <TabsTrigger value="jimeng" className="h-9 px-3 data-active:bg-cyan-300 data-active:text-black">{pick("即梦", "Jimeng")}</TabsTrigger>
                  <TabsTrigger value="manual" className="h-9 px-3 data-active:bg-cyan-300 data-active:text-black">{pick("手动框选", "Manual")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {mode === "manual" ? <div className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.03] p-3">
              <div className="flex items-start gap-2 text-sm text-zinc-300"><MousePointer2 className="mt-0.5 size-4 shrink-0 text-cyan-300" /><span>{pick("在图片上拖动鼠标或手指，仅框住水印文字和少量边缘。选区越紧凑，修复越自然。", "Drag over only the watermark and a small margin. A tighter selection produces a more natural repair.")}</span></div>
              <canvas
                ref={selectionCanvasRef}
                className="max-h-[560px] w-full touch-none cursor-crosshair rounded-lg bg-black object-contain"
                onPointerDown={beginSelection}
                onPointerMove={moveSelection}
                onPointerUp={endSelection}
                onPointerCancel={endSelection}
                aria-label={pick("拖动框选需要处理的水印区域", "Drag to select the watermark area")}
              />
            </div> : null}

            <Alert className="border-amber-400/20 bg-amber-400/[.04] text-zinc-300">
              <AlertTriangle className="text-amber-300" />
              <AlertTitle className="text-zinc-100">{pick("适合处理 AI 平台可见角标", "For visible AI platform marks")}</AlertTitle>
              <AlertDescription>{pick("仅处理你有权编辑的 AI 生成图片。复杂纹理可能需要手动框选；不处理第三方版权水印，也不声称移除 SynthID 等不可见水印。", "Only process AI-generated images you have the right to edit. Complex textures may need manual selection. Third-party copyright marks and invisible signals such as SynthID are not supported.")}</AlertDescription>
            </Alert>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4 text-sm leading-6 text-zinc-300">
              <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} className="mt-1" />
              <span>{pick("我拥有处理这张图片的权利，目标是清理 AI 平台添加的可见角标。", "I have the right to process this image, and the target is a visible mark added by an AI platform.")}</span>
            </label>
            <Button size="lg" onClick={processImage} disabled={!confirmed || running || (mode === "manual" && (!selection || selection.width < 6 || selection.height < 6))} className="bg-cyan-300 text-black hover:bg-cyan-200">
              {running ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {running ? pick("正在本地分析与修复", "Analyzing and repairing locally") : pick("检测并处理可见角标", "Detect and process visible mark")}
            </Button>
          </> : null}
          {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("无法完成处理", "Processing unavailable")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>

      {resultUrl && sourceUrl && meta ? <Card className="border-white/10 bg-[#0c0d0e] shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
              {meta.applied ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertTriangle className="size-5 text-amber-400" />}
              {meta.applied ? pick("本地处理完成", "Local processing complete") : pick("未修改图片", "Image unchanged")}
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{pick(meta.message.zh, meta.message.en)}</p>
          </div>
          <Badge variant="outline" className="border-white/15 text-zinc-300">{providerName(meta.provider, pick)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageCompare before={sourceUrl} after={resultUrl} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Info label={pick("识别结果", "Detection")} value={providerName(meta.provider, pick)} />
            <Info label={pick("置信度", "Confidence")} value={meta.confidence == null ? pick("手动指定", "Manual") : `${Math.round(meta.confidence * 100)}%`} />
            <Info label={pick("隐私", "Privacy")} value={pick("仅在此设备处理", "On this device only")} />
          </div>
          <Button size="lg" disabled={!resultBlob || !meta.applied} onClick={() => resultBlob && file && downloadBlob(resultBlob, `${file.name.replace(/\.[^.]+$/, "")}-visible-mark-cleaned.png`)} className="bg-cyan-300 text-black hover:bg-cyan-200">
            <Download />{pick("下载 PNG 结果", "Download PNG result")}
          </Button>
        </CardContent>
      </Card> : null}
    </div>
  )
}

function drawSelection(image: HTMLImageElement, canvas: HTMLCanvasElement | null, selection: PixelRect | null) {
  if (!canvas) return
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext("2d")
  if (!context) return
  context.drawImage(image, 0, 0)
  if (!selection) return
  context.save()
  context.fillStyle = "rgba(34, 211, 238, .16)"
  context.strokeStyle = "#22d3ee"
  context.lineWidth = Math.max(2, image.naturalWidth / 600)
  context.setLineDash([context.lineWidth * 4, context.lineWidth * 3])
  context.fillRect(selection.x, selection.y, selection.width, selection.height)
  context.strokeRect(selection.x, selection.y, selection.width, selection.height)
  context.restore()
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium text-zinc-100">{value}</p></div>
}
