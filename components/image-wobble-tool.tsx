"use client"

import {
  Brush,
  Check,
  Download,
  Eraser,
  FileImage,
  Gauge,
  ImagePlus,
  LoaderCircle,
  Move,
  Play,
  Redo2,
  RotateCcw,
  Smartphone,
  Undo2,
  UploadCloud,
  Video,
  Waves,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { downloadBlob, formatBytes } from "@/lib/browser-files"
import { validateImageFile } from "@/lib/file-validation"
import {
  defaultWobbleSettings,
  fitWobbleDimensions,
  normalizeWobbleSettings,
  preferredVideoMime,
  wobbleOutputName,
  wobblePresets,
  wobbleVector,
  type WobbleMotion,
  type WobblePresetId,
  type WobbleSettings,
} from "@/lib/image-wobble"
import { cn } from "@/lib/utils"

type EditorMode = "paint" | "preview"
type BrushMode = "paint" | "erase"
type ExportFormat = "gif" | "webm" | "mp4"

type ImageMeta = {
  name: string
  size: number
  format: string
  originalWidth: number
  originalHeight: number
  width: number
  height: number
}

type ExportResult = {
  blob: Blob
  url: string
  name: string
  format: ExportFormat
  width: number
  height: number
}

type Point = { x: number; y: number }

const maxInputBytes = 80 * 1024 * 1024
const maxWorkingSide = 1600
const historyLimit = 24

export function ImageWobbleTool() {
  const { pick } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageCanvasRef = useRef<HTMLCanvasElement>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskOverlayRef = useRef<HTMLCanvasElement | null>(null)
  const motionLayerRef = useRef<HTMLCanvasElement | null>(null)
  const animationOutputRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const drawingRef = useRef(false)
  const draggingPreviewRef = useRef(false)
  const previousPointRef = useRef<Point | null>(null)
  const previewStartRef = useRef<Point | null>(null)
  const manualForceRef = useRef<Point>({ x: 0, y: 0 })
  const historyRef = useRef<ImageData[]>([])
  const historyIndexRef = useRef(-1)
  const resultRef = useRef<ExportResult | null>(null)
  const settingsRef = useRef<WobbleSettings>(defaultWobbleSettings)
  const brushModeRef = useRef<BrushMode>("paint")
  const brushSizeRef = useRef(8)
  const brushStrengthRef = useRef(100)

  const [image, setImage] = useState<ImageMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<EditorMode>("paint")
  const [brushMode, setBrushMode] = useState<BrushMode>("paint")
  const [brushSize, setBrushSize] = useState(8)
  const [brushStrength, setBrushStrength] = useState(100)
  const [zoom, setZoom] = useState(100)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const [hasMask, setHasMask] = useState(false)
  const [preset, setPreset] = useState<WobblePresetId | null>("soft")
  const [settings, setSettings] = useState<WobbleSettings>(defaultWobbleSettings)
  const [sensorAvailable, setSensorAvailable] = useState(false)
  const [sensorEnabled, setSensorEnabled] = useState(false)
  const [sensorError, setSensorError] = useState("")
  const [exportFormat, setExportFormat] = useState<ExportFormat>("gif")
  const [duration, setDuration] = useState(3)
  const [outputMaxSide, setOutputMaxSide] = useState(960)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState("")
  const [draggingFile, setDraggingFile] = useState(false)
  const [videoSupport, setVideoSupport] = useState({ webm: "", mp4: "" })

  brushModeRef.current = brushMode
  brushSizeRef.current = brushSize
  brushStrengthRef.current = brushStrength
  settingsRef.current = settings

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setSensorAvailable("DeviceMotionEvent" in window)
      if (typeof MediaRecorder !== "undefined") {
        setVideoSupport({
          webm: preferredVideoMime("webm", (mime) => MediaRecorder.isTypeSupported(mime)),
          mp4: preferredVideoMime("mp4", (mime) => MediaRecorder.isTypeSupported(mime)),
        })
      }
    })
    return () => {
      active = false
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url)
    }
  }, [])

  useEffect(() => {
    if (!sensorEnabled) return
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity
      if (!acceleration) return
      manualForceRef.current = {
        x: Math.max(-1, Math.min(1, (acceleration.x ?? 0) / 7)),
        y: Math.max(-1, Math.min(1, -(acceleration.y ?? 0) / 7)),
      }
    }
    window.addEventListener("devicemotion", handleMotion)
    return () => window.removeEventListener("devicemotion", handleMotion)
  }, [sensorEnabled])

  useEffect(() => {
    if (!image) return
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    if (mode === "paint") {
      drawPaintView()
      return
    }

    const tick = (timestamp: number) => {
      const target = stageCanvasRef.current
      const source = sourceCanvasRef.current
      const mask = maskCanvasRef.current
      const layer = motionLayerRef.current
      const rendered = animationOutputRef.current
      if (!target || !source || !mask || !layer || !rendered) return
      renderWobbleFrame(rendered, source, mask, layer, timestamp / 1000, settingsRef.current, manualForceRef.current)
      const targetContext = target.getContext("2d")
      targetContext?.clearRect(0, 0, target.width, target.height)
      targetContext?.drawImage(rendered, 0, 0, target.width, target.height)
      if (!draggingPreviewRef.current && !sensorEnabled) {
        manualForceRef.current = {
          x: manualForceRef.current.x * .9,
          y: manualForceRef.current.y * .9,
        }
      }
      animationRef.current = requestAnimationFrame(tick)
    }
    animationRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [image, mode, sensorEnabled])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!image || mode !== "paint") return
      const target = event.target as HTMLElement | null
      if (target?.matches("input, select, textarea")) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redoMask()
        else undoMask()
      }
      if (event.key === "[" || event.key === "]") {
        event.preventDefault()
        setBrushSize((value) => Math.max(1, Math.min(20, value + (event.key === "]" ? 1 : -1))))
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  })

  function ensureCanvas(ref: typeof sourceCanvasRef, width: number, height: number) {
    const canvas = ref.current ?? document.createElement("canvas")
    ref.current = canvas
    canvas.width = width
    canvas.height = height
    return canvas
  }

  function prepareImage(drawable: CanvasImageSource, metadata: Omit<ImageMeta, "width" | "height">) {
    const fitted = fitWobbleDimensions(metadata.originalWidth, metadata.originalHeight, maxWorkingSide)
    const source = ensureCanvas(sourceCanvasRef, fitted.width, fitted.height)
    const mask = ensureCanvas(maskCanvasRef, fitted.width, fitted.height)
    ensureCanvas(maskOverlayRef, fitted.width, fitted.height)
    ensureCanvas(motionLayerRef, fitted.width, fitted.height)
    ensureCanvas(animationOutputRef, fitted.width, fitted.height)
    const target = stageCanvasRef.current
    if (!target) throw new Error(pick("编辑画布尚未准备好。", "The editor canvas is not ready."))
    target.width = fitted.width
    target.height = fitted.height
    source.getContext("2d")?.drawImage(drawable, 0, 0, fitted.width, fitted.height)
    mask.getContext("2d", { willReadFrequently: true })?.clearRect(0, 0, fitted.width, fitted.height)
    historyRef.current = []
    historyIndexRef.current = -1
    setImage({ ...metadata, width: fitted.width, height: fitted.height })
    setMode("paint")
    setHasMask(false)
    setZoom(100)
    updateMaskOverlay()
    commitMaskHistory()
    drawPaintView()
  }

  async function loadFile(file: File) {
    setLoading(true)
    setError("")
    setResultSafely(null)
    try {
      if (file.size > maxInputBytes) throw new Error(pick("图片不能超过 80MB。", "Images must be 80MB or smaller."))
      const validated = await validateImageFile(file)
      const bitmap = await createImageBitmap(validated.file, { imageOrientation: "from-image" })
      try {
        prepareImage(bitmap, {
          name: validated.file.name,
          size: validated.file.size,
          format: validated.format,
          originalWidth: validated.width,
          originalHeight: validated.height,
        })
      } finally {
        bitmap.close()
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : pick("无法读取这张图片。", "Unable to read this image.")
      setError(localizeValidationError(message, pick))
    } finally {
      setLoading(false)
    }
  }

  async function loadSample() {
    setLoading(true)
    setError("")
    try {
      const sample = new window.Image()
      sample.decoding = "async"
      sample.src = "/illustrations/hero-image-workspace.webp"
      await sample.decode()
      prepareImage(sample, {
        name: "tabnative-wobble-sample.webp",
        size: 63_034,
        format: "WebP",
        originalWidth: sample.naturalWidth,
        originalHeight: sample.naturalHeight,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : pick("无法载入示例。", "Unable to load the sample."))
    } finally {
      setLoading(false)
    }
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = stageCanvasRef.current
    if (!canvas) return null
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!image || exporting) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = canvasPoint(event)
    if (!point) return
    if (mode === "preview") {
      draggingPreviewRef.current = true
      previewStartRef.current = point
      return
    }
    drawingRef.current = true
    previousPointRef.current = point
    drawMaskStroke(point, point)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!image) return
    const point = canvasPoint(event)
    if (!point) return
    if (mode === "preview" && draggingPreviewRef.current && previewStartRef.current) {
      const scale = Math.max(1, Math.min(image.width, image.height) * .18)
      manualForceRef.current = {
        x: Math.max(-1, Math.min(1, (point.x - previewStartRef.current.x) / scale)),
        y: Math.max(-1, Math.min(1, (point.y - previewStartRef.current.y) / scale)),
      }
      return
    }
    if (!drawingRef.current || mode !== "paint") return
    drawMaskStroke(previousPointRef.current ?? point, point)
    previousPointRef.current = point
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (mode === "preview") {
      draggingPreviewRef.current = false
      previewStartRef.current = null
      return
    }
    if (!drawingRef.current) return
    drawingRef.current = false
    previousPointRef.current = null
    commitMaskHistory()
  }

  function drawMaskStroke(from: Point, to: Point) {
    const mask = maskCanvasRef.current
    const imageMeta = image
    if (!mask || !imageMeta) return
    const context = mask.getContext("2d", { willReadFrequently: true })
    if (!context) return
    const radius = Math.max(3, Math.min(imageMeta.width, imageMeta.height) * brushSizeRef.current / 100 / 2)
    context.save()
    context.globalCompositeOperation = brushModeRef.current === "erase" ? "destination-out" : "source-over"
    context.globalAlpha = Math.max(.05, brushStrengthRef.current / 100)
    context.strokeStyle = "#fff"
    context.fillStyle = "#fff"
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = radius * 2
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    context.beginPath()
    context.arc(to.x, to.y, radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
    setHasMask(true)
    updateMaskOverlay()
    drawPaintView()
  }

  function updateMaskOverlay() {
    const mask = maskCanvasRef.current
    const overlay = maskOverlayRef.current
    if (!mask || !overlay) return
    const context = overlay.getContext("2d")
    if (!context) return
    context.clearRect(0, 0, overlay.width, overlay.height)
    context.drawImage(mask, 0, 0)
    context.globalCompositeOperation = "source-in"
    const gradient = context.createLinearGradient(0, overlay.height, overlay.width, 0)
    gradient.addColorStop(0, "rgba(34, 211, 238, .72)")
    gradient.addColorStop(.52, "rgba(250, 204, 21, .72)")
    gradient.addColorStop(1, "rgba(244, 63, 94, .78)")
    context.fillStyle = gradient
    context.fillRect(0, 0, overlay.width, overlay.height)
    context.globalCompositeOperation = "source-over"
  }

  function drawPaintView() {
    const target = stageCanvasRef.current
    const source = sourceCanvasRef.current
    const overlay = maskOverlayRef.current
    if (!target || !source || !overlay) return
    const context = target.getContext("2d")
    if (!context) return
    context.clearRect(0, 0, target.width, target.height)
    context.drawImage(source, 0, 0, target.width, target.height)
    context.drawImage(overlay, 0, 0, target.width, target.height)
  }

  function commitMaskHistory() {
    const mask = maskCanvasRef.current
    const context = mask?.getContext("2d", { willReadFrequently: true })
    if (!mask || !context) return
    const snapshot = context.getImageData(0, 0, mask.width, mask.height)
    setHasMask(maskHasContent(snapshot))
    const next = historyRef.current.slice(0, historyIndexRef.current + 1)
    next.push(snapshot)
    if (next.length > historyLimit) next.shift()
    historyRef.current = next
    historyIndexRef.current = next.length - 1
    syncHistoryState()
  }

  function restoreHistory(index: number) {
    const mask = maskCanvasRef.current
    const snapshot = historyRef.current[index]
    const context = mask?.getContext("2d", { willReadFrequently: true })
    if (!mask || !snapshot || !context) return
    context.putImageData(snapshot, 0, 0)
    historyIndexRef.current = index
    setHasMask(maskHasContent(snapshot))
    updateMaskOverlay()
    drawPaintView()
    syncHistoryState()
  }

  function undoMask() {
    if (historyIndexRef.current <= 0) return
    restoreHistory(historyIndexRef.current - 1)
  }

  function redoMask() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    restoreHistory(historyIndexRef.current + 1)
  }

  function syncHistoryState() {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    })
  }

  function replaceMask(action: "clear" | "fill" | "invert") {
    const mask = maskCanvasRef.current
    const context = mask?.getContext("2d", { willReadFrequently: true })
    if (!mask || !context) return
    if (action === "clear") {
      context.clearRect(0, 0, mask.width, mask.height)
      setHasMask(false)
    } else if (action === "fill") {
      context.globalCompositeOperation = "source-over"
      context.globalAlpha = 1
      context.fillStyle = "#fff"
      context.fillRect(0, 0, mask.width, mask.height)
      setHasMask(true)
    } else {
      const data = context.getImageData(0, 0, mask.width, mask.height)
      for (let index = 3; index < data.data.length; index += 4) data.data[index] = 255 - data.data[index]
      context.putImageData(data, 0, 0)
      setHasMask(true)
    }
    updateMaskOverlay()
    drawPaintView()
    commitMaskHistory()
  }

  function applyPreset(id: WobblePresetId) {
    const selected = wobblePresets.find((item) => item.id === id)
    if (!selected) return
    setPreset(id)
    setSettings(selected.settings)
  }

  function updateSetting<Key extends keyof WobbleSettings>(key: Key, value: WobbleSettings[Key]) {
    setPreset(null)
    setSettings((current) => normalizeWobbleSettings({ ...current, [key]: value }))
  }

  async function enableSensor() {
    setSensorError("")
    try {
      const motionType = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> }
      if (motionType.requestPermission) {
        const permission = await motionType.requestPermission()
        if (permission !== "granted") throw new Error(pick("动作传感器权限未开启。", "Motion sensor permission was not granted."))
      }
      setSensorEnabled(true)
    } catch (reason) {
      setSensorEnabled(false)
      setSensorError(reason instanceof Error ? reason.message : pick("无法启用动作传感器。", "Unable to enable the motion sensor."))
    }
  }

  function setResultSafely(next: ExportResult | null) {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url)
    resultRef.current = next
    setResult(next)
  }

  async function exportAnimation() {
    if (!image || exporting || !hasMask) return
    setExporting(true)
    setExportProgress(0)
    setError("")
    setResultSafely(null)
    try {
      // GIF encoding is CPU- and memory-intensive in the browser. Keep its
      // longest edge bounded while video exports may use the selected size.
      const effectiveMaxSide = exportFormat === "gif" ? Math.min(outputMaxSide, 640) : outputMaxSide
      const dimensions = fitWobbleDimensions(image.width, image.height, effectiveMaxSide)
      const canvases = createScaledCanvases(dimensions.width, dimensions.height, sourceCanvasRef.current!, maskCanvasRef.current!)
      let blob: Blob
      if (exportFormat === "gif") {
        blob = await exportGif(canvases, duration, settings, (value) => setExportProgress(value))
      } else {
        const mimeType = exportFormat === "mp4" ? videoSupport.mp4 : videoSupport.webm
        if (!mimeType) throw new Error(pick("当前浏览器不支持所选视频格式，请改用 GIF 或 WebM。", "This browser does not support the selected video format. Use GIF or WebM instead."))
        blob = await exportVideo(canvases, duration, settings, mimeType, (value) => setExportProgress(value))
      }
      const name = wobbleOutputName(image.name, exportFormat)
      setResultSafely({
        blob,
        url: URL.createObjectURL(blob),
        name,
        format: exportFormat,
        width: dimensions.width,
        height: dimensions.height,
      })
      setExportProgress(100)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : pick("动画生成失败，请降低输出尺寸后重试。", "Animation export failed. Reduce the output size and try again."))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-[#0d0d0d] py-0 text-zinc-100 shadow-none">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <div className="flex rounded-lg border border-white/10 bg-white/[.025] p-1">
            <ModeButton active={mode === "paint"} disabled={!image || exporting} icon={Brush} label={pick("涂抹区域", "Paint area")} onClick={() => setMode("paint")} />
            <ModeButton active={mode === "preview"} disabled={!image || exporting} icon={Waves} label={pick("预览晃动", "Preview wobble")} onClick={() => setMode("preview")} />
          </div>
          {image ? (
            <div className="min-w-0 text-xs text-zinc-500">
              <span className="block max-w-64 truncate font-medium text-zinc-300">{image.name}</span>
              <span>{image.originalWidth} × {image.originalHeight} · {image.format} · {formatBytes(image.size)}</span>
            </div>
          ) : <span className="text-xs text-zinc-500">{pick("选择一张图片即可开始", "Choose one image to begin")}</span>}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={!image || zoom <= 50} onClick={() => setZoom((value) => Math.max(50, value - 25))} aria-label={pick("缩小", "Zoom out")}><ZoomOut /></Button>
            <button type="button" className="min-w-12 font-mono text-xs text-zinc-500" disabled={!image} onClick={() => setZoom(100)}>{zoom}%</button>
            <Button variant="ghost" size="icon-sm" disabled={!image || zoom >= 200} onClick={() => setZoom((value) => Math.min(200, value + 25))} aria-label={pick("放大", "Zoom in")}><ZoomIn /></Button>
            {image ? <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={exporting}><ImagePlus />{pick("更换图片", "Replace")}</Button> : null}
          </div>
        </div>

        <input ref={fileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.currentTarget.value = "" }} />

        <div className="grid min-h-[640px] items-start lg:grid-cols-[minmax(0,1fr)_320px]">
          <main
            className={cn("relative flex min-h-[460px] items-center justify-center overflow-auto border-b border-white/10 bg-[#080808] p-4 lg:h-[640px] lg:border-b-0 lg:border-r", draggingFile && "bg-cyan-300/[.04]")}
            onDragEnter={(event) => { event.preventDefault(); setDraggingFile(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFile(false) }}
            onDrop={(event) => { event.preventDefault(); setDraggingFile(false); const file = event.dataTransfer.files?.[0]; if (file) void loadFile(file) }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(45deg,rgba(255,255,255,.035)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,.035)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,.035)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,.035)_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px]" />
            <canvas
              ref={stageCanvasRef}
              aria-label={pick("图片晃动编辑画布", "Image wobble editing canvas")}
              className={cn("relative max-w-none touch-none rounded-lg shadow-2xl", mode === "paint" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing", !image && "invisible")}
              style={{ width: `${zoom}%`, height: "auto" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            />

            {!image ? (
              <div className="absolute inset-0 z-10 grid place-items-center p-5">
                <div className="w-full max-w-md rounded-xl border border-dashed border-white/20 bg-[#0d0d0d]/95 p-8 text-center">
                  {loading ? <LoaderCircle className="mx-auto size-10 animate-spin text-cyan-300" /> : <UploadCloud className="mx-auto size-10 text-cyan-300" />}
                  <h2 className="mt-4 text-lg font-semibold text-white">{loading ? pick("正在准备图片", "Preparing image") : pick("导入一张静态图片", "Import a still image")}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{pick("支持 PNG、JPG、WebP，最大 80MB。图片只在当前设备处理。", "Supports PNG, JPG, and WebP up to 80MB. The image stays on this device.")}</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => fileInputRef.current?.click()} disabled={loading}><FileImage />{pick("选择图片", "Choose image")}</Button>
                    <Button variant="outline" onClick={() => void loadSample()} disabled={loading}><Play />{pick("试用示例", "Try sample")}</Button>
                  </div>
                  <p className="mt-4 text-xs text-zinc-600">{pick("也可以把图片拖到这里", "You can also drop an image here")}</p>
                </div>
              </div>
            ) : null}

            {draggingFile ? <div className="pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-xl border-2 border-dashed border-cyan-300 bg-[#080808]/90 text-sm font-semibold text-cyan-200">{pick("松开以更换图片", "Drop to replace the image")}</div> : null}
          </main>

          <aside className="space-y-5 p-4">
            {mode === "paint" ? (
              <section aria-labelledby="wobble-mask-title">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 id="wobble-mask-title" className="font-semibold text-white">{pick("涂出晃动区域", "Paint the wobble area")}</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{pick("有颜色的区域会参与晃动；未涂抹区域保持稳定。", "Colored areas will wobble; unpainted areas stay stable.")}</p></div>
                  <Brush className="mt-0.5 size-4 text-cyan-300" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant={brushMode === "paint" ? "default" : "outline"} onClick={() => setBrushMode("paint")} disabled={!image}><Brush />{pick("涂抹", "Paint")}</Button>
                  <Button variant={brushMode === "erase" ? "default" : "outline"} onClick={() => setBrushMode("erase")} disabled={!image}><Eraser />{pick("擦除", "Erase")}</Button>
                </div>
                <div className="mt-4 space-y-4">
                  <RangeField label={pick("画笔粗细", "Brush size")} value={`${brushSize}%`}><Input type="range" min="1" max="20" value={brushSize} disabled={!image} onChange={(event) => setBrushSize(Number(event.target.value))} /></RangeField>
                  <RangeField label={pick("画笔强度", "Brush strength")} value={`${brushStrength}%`}><Input type="range" min="10" max="100" step="5" value={brushStrength} disabled={!image} onChange={(event) => setBrushStrength(Number(event.target.value))} /></RangeField>
                  <div className="flex justify-between text-[11px] text-zinc-500"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-cyan-400" />{pick("弱", "Weak")}</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-yellow-400" />{pick("中", "Medium")}</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-rose-500" />{pick("强", "Strong")}</span></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={undoMask} disabled={!historyState.canUndo}><Undo2 />{pick("撤销", "Undo")}</Button>
                  <Button variant="outline" onClick={redoMask} disabled={!historyState.canRedo}><Redo2 />{pick("重做", "Redo")}</Button>
                  <Button variant="ghost" onClick={() => replaceMask("clear")} disabled={!image}>{pick("重置涂抹", "Clear mask")}</Button>
                  <Button variant="ghost" onClick={() => replaceMask("fill")} disabled={!image}>{pick("全部涂满", "Fill all")}</Button>
                  <Button className="col-span-2" variant="ghost" onClick={() => replaceMask("invert")} disabled={!image}>{pick("反转涂抹区域", "Invert mask")}</Button>
                </div>
                <div className="mt-4 rounded-lg border border-white/10 bg-white/[.025] p-3 text-xs leading-5 text-zinc-500">
                  {pick("快捷键：Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 重做，[ 与 ] 调整画笔。", "Shortcuts: Ctrl/⌘+Z to undo, Ctrl/⌘+Shift+Z to redo, [ and ] to resize the brush.")}
                </div>
              </section>
            ) : (
              <section aria-labelledby="wobble-settings-title">
                <div className="flex items-start justify-between gap-3"><div><h2 id="wobble-settings-title" className="font-semibold text-white">{pick("晃动设置", "Wobble settings")}</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{pick("选择预设后可继续细调，也可以拖动画面施加方向。", "Choose a preset, fine-tune it, or drag the canvas to apply direction.")}</p></div><Waves className="mt-0.5 size-4 text-cyan-300" /></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {wobblePresets.map((item) => <button key={item.id} type="button" aria-pressed={preset === item.id} onClick={() => applyPreset(item.id)} className={cn("rounded-lg border border-white/10 bg-white/[.025] p-2.5 text-left transition hover:border-cyan-300/35", preset === item.id && "border-cyan-300/50 bg-cyan-300/[.08]")}><span className="block text-xs font-semibold text-zinc-200">{pick(item.name.zh, item.name.en)}</span><span className="mt-1 block text-[10px] leading-4 text-zinc-600">{pick(item.description.zh, item.description.en)}</span></button>)}
                </div>
                <label className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[.025] p-3 text-sm"><span><span className="block font-medium text-zinc-200">{pick("自动晃动", "Auto wobble")}</span><span className="mt-1 block text-xs text-zinc-500">{pick("关闭后只响应拖拽或传感器", "When off, only drag or sensor input moves it")}</span></span><Switch checked={settings.auto} onCheckedChange={(checked) => updateSetting("auto", checked)} /></label>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(["sway", "hop", "orbit"] as WobbleMotion[]).map((motion) => <Button key={motion} size="sm" variant={settings.motion === motion ? "default" : "outline"} onClick={() => updateSetting("motion", motion)}>{motion === "sway" ? pick("摇摆", "Sway") : motion === "hop" ? pick("弹跳", "Hop") : pick("绕圈", "Orbit")}</Button>)}
                </div>
                <div className="mt-4 space-y-3.5">
                  <RangeField label={pick("晃动强度", "Motion strength")} value={`${Math.round(settings.strength)}%`}><Input type="range" min="0" max="100" value={settings.strength} onChange={(event) => updateSetting("strength", Number(event.target.value))} /></RangeField>
                  <RangeField label={pick("晃动速度", "Motion speed")} value={`${settings.speed.toFixed(1)}×`}><Input type="range" min="0.2" max="3" step="0.1" value={settings.speed} onChange={(event) => updateSetting("speed", Number(event.target.value))} /></RangeField>
                  <RangeField label={pick("伸展", "Stretch")} value={`${Math.round(settings.stretch)}%`}><Input type="range" min="0" max="100" value={settings.stretch} onChange={(event) => updateSetting("stretch", Number(event.target.value))} /></RangeField>
                  <RangeField label={pick("回弹", "Bounce")} value={`${Math.round(settings.bounce)}%`}><Input type="range" min="0" max="100" value={settings.bounce} onChange={(event) => updateSetting("bounce", Number(event.target.value))} /></RangeField>
                  <RangeField label={pick("稳定", "Damping")} value={`${Math.round(settings.damping)}%`}><Input type="range" min="0" max="100" value={settings.damping} onChange={(event) => updateSetting("damping", Number(event.target.value))} /></RangeField>
                </div>
                {sensorAvailable ? <div className="mt-4"><Button className="w-full" variant={sensorEnabled ? "default" : "outline"} onClick={() => sensorEnabled ? setSensorEnabled(false) : void enableSensor()}><Smartphone />{sensorEnabled ? pick("关闭动作传感器", "Disable motion sensor") : pick("用手机动作控制", "Control with device motion")}</Button>{sensorError ? <p className="mt-2 text-xs text-red-300">{sensorError}</p> : null}</div> : null}
              </section>
            )}

            <section className="border-t border-white/10 pt-4" aria-labelledby="wobble-export-title">
              <div className="flex items-center justify-between"><h2 id="wobble-export-title" className="font-semibold text-white">{pick("生成与保存", "Create and save")}</h2><Video className="size-4 text-cyan-300" /></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["gif", "webm", "mp4"] as ExportFormat[]).map((format) => <Button key={format} size="sm" variant={exportFormat === format ? "default" : "outline"} disabled={format === "webm" ? !videoSupport.webm : format === "mp4" ? !videoSupport.mp4 : false} onClick={() => setExportFormat(format)}>{format.toUpperCase()}</Button>)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs text-zinc-500"><span>{pick("动画时长", "Duration")}</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-zinc-200"><option value="2">2s</option><option value="3">3s</option><option value="5">5s</option></select></label>
                <label className="space-y-1.5 text-xs text-zinc-500"><span>{pick("最长边", "Longest side")}</span><select value={outputMaxSide} onChange={(event) => setOutputMaxSide(Number(event.target.value))} className="h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-zinc-200"><option value="640">640px</option><option value="960">960px</option><option value="1600">1600px</option></select></label>
              </div>
              <Button className="mt-3 w-full" onClick={() => void exportAnimation()} disabled={!image || !hasMask || exporting}>{exporting ? <LoaderCircle className="animate-spin" /> : <Gauge />}{exporting ? pick("正在生成动画", "Creating animation") : pick("生成本地动画", "Create local animation")}</Button>
              {!hasMask && image ? <p className="mt-2 text-xs leading-5 text-amber-300">{pick("请先在图片上涂出至少一个晃动区域。", "Paint at least one wobble area before exporting.")}</p> : null}
              {exportFormat === "gif" && outputMaxSide > 640 ? <p className="mt-2 text-xs leading-5 text-zinc-500">{pick("GIF 为保证浏览器稳定生成，最长边会自动限制为 640 px。", "GIF exports are capped at 640 px on the longest side for reliable in-browser encoding.")}</p> : null}
              {exporting ? <Progress className="mt-3" value={exportProgress}><ProgressLabel>{pick("生成进度", "Export progress")}</ProgressLabel><ProgressValue>{() => `${Math.round(exportProgress)}%`}</ProgressValue></Progress> : null}
            </section>
          </aside>
        </div>
      </Card>

      {error ? <Alert variant="destructive"><AlertTitle>{pick("操作未完成", "Action not completed")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      {result ? (
        <Card className="border-emerald-300/20 bg-[#0d0d0d] text-zinc-100">
          <CardHeader><CardTitle className="flex items-center gap-2"><Check className="size-4 text-emerald-300" />{pick("动画已生成", "Animation created")}</CardTitle><CardDescription>{result.width} × {result.height} · {formatBytes(result.blob.size)} · {result.format.toUpperCase()}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="grid min-h-52 place-items-center overflow-hidden rounded-lg border border-white/10 bg-[#080808] p-3">{result.format === "gif" ? <Image src={result.url} width={result.width} height={result.height} unoptimized alt={pick("生成的晃动 GIF 预览", "Generated wobble GIF preview")} className="max-h-80 max-w-full object-contain" /> : <video src={result.url} autoPlay loop muted controls playsInline className="max-h-80 max-w-full object-contain" />}</div>
            <div className="space-y-2 md:w-48"><Button className="w-full" onClick={() => downloadBlob(result.blob, result.name)}><Download />{pick("下载动画", "Download animation")}</Button><Button className="w-full" variant="outline" onClick={() => { setMode("paint"); setResultSafely(null) }}><RotateCcw />{pick("继续调整", "Keep editing")}</Button></div>
          </CardContent>
        </Card>
      ) : null}

      <Alert className="border-cyan-300/15 bg-cyan-300/[.03]"><Move /><AlertTitle>{pick("适合哪些图片", "Best suited to")}</AlertTitle><AlertDescription>{pick("人物头发、衣角、耳朵、贴纸、头像、宠物、玩偶和带透明背景的插画效果最好。照片也能使用，但主体边界越清晰越自然。", "Hair, clothing, ears, stickers, avatars, pets, toys, and transparent illustrations work best. Photos also work, but clear subject boundaries produce more natural motion.")}</AlertDescription></Alert>
    </div>
  )
}

function ModeButton({ active, disabled, icon: Icon, label, onClick }: { active: boolean; disabled: boolean; icon: typeof Brush; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-zinc-500 transition disabled:opacity-50", active && "bg-cyan-300 text-[#07111f]")}><Icon className="size-3.5" />{label}</button>
}

function RangeField({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs text-zinc-400"><span className="flex items-center justify-between gap-3"><span>{label}</span><span className="font-mono text-zinc-500">{value}</span></span>{children}</label>
}

function maskHasContent(snapshot: ImageData) {
  for (let index = 3; index < snapshot.data.length; index += 4) if (snapshot.data[index] > 4) return true
  return false
}

function localizeValidationError(message: string, pick: (zh: string, en: string) => string) {
  if (message.includes("文件内容不是受支持")) return pick("文件内容不是受支持的 JPG、PNG 或 WebP 图片。", "The file is not a supported JPG, PNG, or WebP image.")
  if (message.includes("图片像素不能超过")) return pick(message, "The image has too many pixels for safe local processing.")
  if (message.includes("浏览器无法解码")) return pick("浏览器无法解码这张图片，文件可能已损坏。", "The browser could not decode this image. The file may be damaged.")
  return message
}

function createScaledCanvases(width: number, height: number, sourceInput: HTMLCanvasElement, maskInput: HTMLCanvasElement) {
  const source = document.createElement("canvas")
  const mask = document.createElement("canvas")
  const layer = document.createElement("canvas")
  const output = document.createElement("canvas")
  for (const canvas of [source, mask, layer, output]) {
    canvas.width = width
    canvas.height = height
  }
  source.getContext("2d")?.drawImage(sourceInput, 0, 0, width, height)
  mask.getContext("2d")?.drawImage(maskInput, 0, 0, width, height)
  return { source, mask, layer, output }
}

function renderWobbleFrame(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  layer: HTMLCanvasElement,
  timeSeconds: number,
  settingsInput: WobbleSettings,
  manual: Point,
) {
  const context = output.getContext("2d")
  const layerContext = layer.getContext("2d")
  if (!context || !layerContext) return
  const settings = normalizeWobbleSettings(settingsInput)
  const vector = wobbleVector(timeSeconds, settings, manual)
  const width = output.width
  const height = output.height
  const strength = Math.min(width, height) * settings.strength / 100 * .13
  const secondary = (1 - settings.damping / 135) * strength
  const stretch = settings.stretch / 100
  const rebound = settings.bounce / 100
  const bands = Math.max(18, Math.min(42, Math.round(height / 28)))
  const bandHeight = height / bands
  const phase = timeSeconds * Math.PI * 2 * settings.speed

  context.clearRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)
  layerContext.clearRect(0, 0, width, height)
  layerContext.globalCompositeOperation = "source-over"
  layerContext.globalAlpha = 1
  layerContext.filter = "none"

  for (let band = 0; band < bands; band += 1) {
    const sourceY = Math.floor(band * bandHeight)
    const sourceHeight = Math.ceil(Math.min(height - sourceY, bandHeight + 1))
    const normalizedY = (sourceY + sourceHeight / 2) / height
    const wave = Math.sin(phase * (1.35 + rebound * .8) + normalizedY * Math.PI * (2.2 + stretch * 2.8))
    const counterWave = Math.cos(phase * (.82 + rebound * .35) + normalizedY * Math.PI * 1.6)
    const edgeWeight = .42 + Math.sin(normalizedY * Math.PI) * .58
    const dx = (vector.x * strength + wave * secondary * .42) * edgeWeight
    const dy = (vector.y * strength * .62 + counterWave * secondary * .22) * edgeWeight
    const scaleX = 1 + wave * stretch * .024
    const destinationWidth = width * scaleX
    const destinationX = dx - (destinationWidth - width) / 2
    layerContext.drawImage(source, 0, sourceY, width, sourceHeight, destinationX, sourceY + dy, destinationWidth, sourceHeight + 1)
  }

  layerContext.save()
  layerContext.globalCompositeOperation = "destination-in"
  layerContext.filter = `blur(${Math.max(.6, Math.min(width, height) / 900)}px)`
  layerContext.drawImage(mask, 0, 0, width, height)
  layerContext.restore()
  context.drawImage(layer, 0, 0, width, height)
}

async function exportGif(
  canvases: ReturnType<typeof createScaledCanvases>,
  duration: number,
  settings: WobbleSettings,
  onProgress: (value: number) => void,
) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc")
  const gif = GIFEncoder()
  const fps = 12
  const frames = duration * fps
  for (let index = 0; index < frames; index += 1) {
    renderWobbleFrame(canvases.output, canvases.source, canvases.mask, canvases.layer, index / fps, settings, { x: 0, y: 0 })
    const rgba = canvases.output.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvases.output.width, canvases.output.height).data
    const palette = quantize(rgba, 256)
    gif.writeFrame(applyPalette(rgba, palette), canvases.output.width, canvases.output.height, { palette, delay: Math.round(1000 / fps), repeat: 0 })
    onProgress((index + 1) / frames * 100)
    if (index % 2 === 1) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  gif.finish()
  const encoded = Uint8Array.from(gif.bytes())
  return new Blob([encoded.buffer as ArrayBuffer], { type: "image/gif" })
}

async function exportVideo(
  canvases: ReturnType<typeof createScaledCanvases>,
  duration: number,
  settings: WobbleSettings,
  mimeType: string,
  onProgress: (value: number) => void,
) {
  const stream = canvases.output.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
  const chunks: Blob[] = []
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => reject(new Error("MediaRecorder failed"))
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }))
  })
  recorder.start(250)
  const start = performance.now()
  await new Promise<void>((resolve) => {
    const draw = (timestamp: number) => {
      const elapsed = Math.min(duration, (timestamp - start) / 1000)
      renderWobbleFrame(canvases.output, canvases.source, canvases.mask, canvases.layer, elapsed, settings, { x: 0, y: 0 })
      onProgress(elapsed / duration * 100)
      if (elapsed >= duration) resolve()
      else requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
  })
  recorder.stop()
  const blob = await done
  stream.getTracks().forEach((track) => track.stop())
  return blob
}
