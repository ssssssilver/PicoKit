"use client"

import { Brush, Eraser, LoaderCircle, RotateCcw, Undo2, ZoomIn, ZoomOut } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { backgroundRefinementShortcut, canRefineBackground, sourceBrushSize } from "@/lib/background-removal"

type BrushTool = "keep" | "remove"
type Point = { x: number; y: number }
type Stroke = { tool: BrushTool; size: number; points: Point[] }
type ActiveStroke = Stroke & { pointerId: number }

const PREVIEW_MAX_WIDTH = 960
const PREVIEW_MAX_HEIGHT = 680
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.25

export function BackgroundMaskEditor({ source, result, onApply }: {
  source: File
  result: Blob
  onApply: (blob: Blob) => void | Promise<void>
}) {
  const { pick } = useLanguage()
  const pickRef = useRef(pick)
  pickRef.current = pick
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const sourceBitmapRef = useRef<ImageBitmap | null>(null)
  const resultBitmapRef = useRef<ImageBitmap | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const activeStrokeRef = useRef<ActiveStroke | null>(null)
  const softnessRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [tool, setTool] = useState<BrushTool>("keep")
  const [brushSize, setBrushSize] = useState(44)
  const [softness, setSoftness] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [applying, setApplying] = useState(false)
  const [brushCursor, setBrushCursor] = useState({ x: 0, y: 0, scale: 1, visible: false })
  const shortcutActionsRef = useRef({ undo: () => {}, reset: () => {} })

  useEffect(() => {
    let cancelled = false

    void Promise.all([createImageBitmap(source), createImageBitmap(result)]).then(([sourceBitmap, resultBitmap]) => {
      if (cancelled) {
        sourceBitmap.close()
        resultBitmap.close()
        return
      }
      if (!canRefineBackground(sourceBitmap.width, sourceBitmap.height)) {
        sourceBitmap.close()
        resultBitmap.close()
        setError(pickRef.current(
          "这张图片可以正常下载，但尺寸过大，不适合在当前标签页继续修边。请先进入图片优化缩小尺寸。",
          "This result can still be downloaded, but it is too large for edge refinement in this tab. Optimize the image dimensions first.",
        ))
        return
      }

      sourceBitmapRef.current?.close()
      resultBitmapRef.current?.close()
      sourceBitmapRef.current = sourceBitmap
      resultBitmapRef.current = resultBitmap

      const maskCanvas = document.createElement("canvas")
      maskCanvas.width = sourceBitmap.width
      maskCanvas.height = sourceBitmap.height
      maskCanvasRef.current = maskCanvas

      const previewCanvas = canvasRef.current
      if (!previewCanvas) return
      const scale = Math.min(1, PREVIEW_MAX_WIDTH / sourceBitmap.width, PREVIEW_MAX_HEIGHT / sourceBitmap.height)
      previewCanvas.width = Math.max(1, Math.round(sourceBitmap.width * scale))
      previewCanvas.height = Math.max(1, Math.round(sourceBitmap.height * scale))
      resetMaskFromResult()
      renderPreview(softnessRef.current)
      setReady(true)
    }).catch(() => {
      if (!cancelled) setError(pickRef.current(
        "无法准备边缘修正画布，透明 PNG 仍可正常下载。",
        "Edge refinement could not start. The transparent PNG is still available to download.",
      ))
    })

    return () => {
      cancelled = true
      sourceBitmapRef.current?.close()
      resultBitmapRef.current?.close()
      sourceBitmapRef.current = null
      resultBitmapRef.current = null
      maskCanvasRef.current = null
    }
  }, [source, result])

  useEffect(() => {
    softnessRef.current = softness
    renderPreview(softness)
  }, [softness])

  function resetMaskFromResult() {
    const mask = maskCanvasRef.current
    const bitmap = resultBitmapRef.current
    const context = mask?.getContext("2d")
    if (!mask || !bitmap || !context) return
    context.save()
    context.clearRect(0, 0, mask.width, mask.height)
    context.globalCompositeOperation = "source-over"
    context.filter = "none"
    context.drawImage(bitmap, 0, 0, mask.width, mask.height)
    context.globalCompositeOperation = "source-in"
    context.fillStyle = "#fff"
    context.fillRect(0, 0, mask.width, mask.height)
    context.restore()
  }

  function renderPreview(nextSoftness: number) {
    const canvas = canvasRef.current
    const sourceBitmap = sourceBitmapRef.current
    const mask = maskCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !sourceBitmap || !mask || !context) return
    context.save()
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = "source-over"
    context.filter = "none"
    context.drawImage(sourceBitmap, 0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = "destination-in"
    context.filter = nextSoftness > 0 ? `blur(${nextSoftness}px)` : "none"
    context.drawImage(mask, 0, 0, canvas.width, canvas.height)
    context.restore()
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current
    const mask = maskCanvasRef.current
    if (!canvas || !mask) return null
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    const previewX = (event.clientX - bounds.left) * canvas.width / bounds.width
    const previewY = (event.clientY - bounds.top) * canvas.height / bounds.height
    return {
      x: Math.max(0, Math.min(mask.width, previewX * mask.width / canvas.width)),
      y: Math.max(0, Math.min(mask.height, previewY * mask.height / canvas.height)),
    }
  }

  function updateBrushCursor(event: React.PointerEvent<HTMLCanvasElement>, visible = true) {
    const canvas = canvasRef.current
    if (!canvas || !ready || applying) {
      setBrushCursor((current) => ({ ...current, visible: false }))
      return
    }
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    setBrushCursor({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      scale: bounds.width / canvas.width,
      visible: visible && event.pointerType !== "touch",
    })
  }

  function drawSegment(stroke: Stroke, from: Point, to: Point) {
    const mask = maskCanvasRef.current
    const context = mask?.getContext("2d")
    if (!mask || !context) return
    context.save()
    context.globalCompositeOperation = stroke.tool === "keep" ? "source-over" : "destination-out"
    context.strokeStyle = "#fff"
    context.fillStyle = "#fff"
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = stroke.size
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    if (from.x === to.x && from.y === to.y) {
      context.beginPath()
      context.arc(from.x, from.y, stroke.size / 2, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  }

  function rebuildMask() {
    resetMaskFromResult()
    for (const stroke of strokesRef.current) {
      const first = stroke.points[0]
      if (!first) continue
      drawSegment(stroke, first, first)
      for (let index = 1; index < stroke.points.length; index += 1) {
        drawSegment(stroke, stroke.points[index - 1], stroke.points[index])
      }
    }
    renderPreview(softnessRef.current)
  }

  function startStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready || applying) return
    updateBrushCursor(event)
    const point = pointFromEvent(event)
    const canvas = canvasRef.current
    const mask = maskCanvasRef.current
    if (!point || !canvas || !mask) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    const stroke: ActiveStroke = {
      tool,
      pointerId: event.pointerId,
      size: sourceBrushSize(brushSize, mask.width, canvas.width),
      points: [point],
    }
    activeStrokeRef.current = stroke
    drawSegment(stroke, point, point)
    renderPreview(softnessRef.current)
  }

  function continueStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    updateBrushCursor(event)
    const stroke = activeStrokeRef.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    const point = pointFromEvent(event)
    const previous = stroke.points.at(-1)
    if (!point || !previous) return
    event.preventDefault()
    stroke.points.push(point)
    drawSegment(stroke, previous, point)
    renderPreview(softnessRef.current)
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = activeStrokeRef.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    strokesRef.current.push({ tool: stroke.tool, size: stroke.size, points: stroke.points })
    activeStrokeRef.current = null
    setHistoryVersion((value) => value + 1)
  }

  function undo() {
    if (!strokesRef.current.length || applying) return
    strokesRef.current.pop()
    activeStrokeRef.current = null
    rebuildMask()
    setHistoryVersion((value) => value + 1)
  }

  function reset() {
    if (applying) return
    strokesRef.current = []
    activeStrokeRef.current = null
    setSoftness(0)
    softnessRef.current = 0
    rebuildMask()
    setHistoryVersion((value) => value + 1)
  }

  shortcutActionsRef.current = { undo, reset }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!ready || applying || event.defaultPrevented) return
      const editor = editorRef.current
      const activeElement = document.activeElement
      if (!editor || !activeElement || !editor.contains(activeElement)) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return

      const shortcut = backgroundRefinementShortcut(event)
      if (!shortcut) return
      event.preventDefault()
      shortcutActionsRef.current[shortcut]()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [applying, ready])

  async function apply() {
    const sourceBitmap = sourceBitmapRef.current
    const mask = maskCanvasRef.current
    const preview = canvasRef.current
    if (!sourceBitmap || !mask || !preview || applying) return
    setApplying(true)
    setError("")
    try {
      const output = document.createElement("canvas")
      output.width = sourceBitmap.width
      output.height = sourceBitmap.height
      const context = output.getContext("2d")
      if (!context) throw new Error("Canvas unavailable")
      context.drawImage(sourceBitmap, 0, 0)
      context.globalCompositeOperation = "destination-in"
      const sourceScale = sourceBitmap.width / preview.width
      context.filter = softnessRef.current > 0 ? `blur(${softnessRef.current * sourceScale}px)` : "none"
      context.drawImage(mask, 0, 0)
      context.filter = "none"
      const blob = await new Promise<Blob>((resolve, reject) => {
        output.toBlob((value) => value ? resolve(value) : reject(new Error("PNG encoding failed")), "image/png")
      })
      await onApply(blob)
    } catch {
      setError(pick(
        "未能应用边缘修正，当前透明 PNG 未被改动。",
        "The edge refinements could not be applied. The current transparent PNG was not changed.",
      ))
    } finally {
      setApplying(false)
    }
  }

  const hasHistory = historyVersion >= 0 && strokesRef.current.length > 0

  function changeZoom(direction: -1 | 1) {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + direction * ZOOM_STEP)))
    setBrushCursor((current) => ({ ...current, visible: false }))
  }

  return (
    <div ref={editorRef}>
    <Card className="border-cyan-300/20 bg-cyan-300/[.025] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-100">{pick("边缘修正", "Refine edges")}</CardTitle>
        <p className="text-sm leading-6 text-zinc-500">{pick(
          "用“保留”画回误删的主体，用“移除”擦掉残留背景，再调整边缘柔化后应用。修正只改变透明蒙版，不会上传图片。",
          "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.",
        )}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-1" role="group" aria-label={pick("预览缩放", "Preview zoom")}>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => changeZoom(-1)} disabled={!ready || applying || zoom <= MIN_ZOOM} aria-label={pick("缩小图片", "Zoom out")}><ZoomOut /></Button>
            <button type="button" onClick={() => setZoom(1)} disabled={!ready || applying} className="min-w-16 rounded-md border border-white/10 px-2 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-50" aria-label={pick("恢复 100% 缩放", "Reset zoom to 100%")} title={pick("点击恢复 100%", "Click to reset to 100%")}>
              {Math.round(zoom * 100)}%
            </button>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => changeZoom(1)} disabled={!ready || applying || zoom >= MAX_ZOOM} aria-label={pick("放大图片", "Zoom in")}><ZoomIn /></Button>
          </div>
          <div className="max-h-[720px] overflow-auto rounded-xl border border-white/10 bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-1">
            <div className="relative mx-auto" style={{ width: `${zoom * 100}%` }}>
              <canvas
                ref={canvasRef}
                tabIndex={0}
                className="block h-auto w-full touch-none cursor-none object-contain"
                aria-label={pick("背景边缘修正画布", "Background edge-refinement canvas")}
                onPointerDown={startStroke}
                onPointerMove={continueStroke}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                onPointerEnter={(event) => updateBrushCursor(event)}
                onPointerLeave={(event) => updateBrushCursor(event, false)}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,.75)] ${tool === "keep" ? "border-emerald-300 bg-emerald-300/10" : "border-rose-300 bg-rose-300/10"}`}
                style={{
                  width: `${Math.max(8, brushSize * brushCursor.scale)}px`,
                  height: `${Math.max(8, brushSize * brushCursor.scale)}px`,
                  left: `${brushCursor.x}px`,
                  top: `${brushCursor.y}px`,
                  opacity: brushCursor.visible ? 1 : 0,
                  transform: "translate(-50%, -50%)",
                }}
              ><span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,.8)]" /></span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[.025] p-4 md:grid-cols-2 md:items-end">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={tool === "keep" ? "default" : "outline"} onClick={() => setTool("keep")} disabled={!ready || applying}><Brush />{pick("保留", "Keep")}</Button>
            <Button type="button" variant={tool === "remove" ? "default" : "outline"} onClick={() => setTool("remove")} disabled={!ready || applying}><Eraser />{pick("移除", "Remove")}</Button>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button type="button" variant="outline" onClick={undo} disabled={!ready || !hasHistory || applying} aria-keyshortcuts="Control+Z Meta+Z"><Undo2 />{pick("撤销", "Undo")}<ShortcutLabel>Ctrl/⌘ Z</ShortcutLabel></Button>
            <Button type="button" variant="outline" onClick={reset} disabled={!ready || applying} aria-keyshortcuts="R"><RotateCcw />{pick("重置", "Reset")}<ShortcutLabel>R</ShortcutLabel></Button>
            <Button type="button" onClick={() => void apply()} disabled={!ready || applying}>{applying ? <LoaderCircle className="animate-spin" /> : null}{pick("应用", "Apply")}</Button>
          </div>
          <label className="grid gap-2 text-xs text-zinc-400">
            <span className="flex items-center justify-between gap-3"><span>{pick("画笔大小", "Brush size")}</span><span>{brushSize}px</span></span>
            <input className="h-2 w-full cursor-pointer accent-cyan-400" type="range" min="8" max="120" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} disabled={!ready || applying} />
          </label>
          <label className="grid gap-2 text-xs text-zinc-400">
            <span className="flex items-center justify-between gap-3"><span>{pick("边缘柔化", "Edge softness")}</span><span>{softness}px</span></span>
            <input className="h-2 w-full cursor-pointer accent-cyan-400" type="range" min="0" max="12" step="1" value={softness} onChange={(event) => setSoftness(Number(event.target.value))} disabled={!ready || applying} />
          </label>
        </div>
        <p className="text-xs leading-5 text-zinc-500">{pick(
          "点击画布后可使用 Ctrl/⌘ + Z 撤销，按 R 重置。边缘柔化会同时显示在预览和最终透明 PNG 中；原始图片始终保持不变。",
          "After focusing the canvas, use Ctrl/⌘ + Z to undo or R to reset. Edge softness appears in the preview and final transparent PNG; the source image remains unchanged.",
        )}</p>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>
    </div>
  )
}

function ShortcutLabel({ children }: { children: React.ReactNode }) {
  return <kbd className="ml-1 rounded border border-white/10 bg-white/[.04] px-1.5 py-0.5 font-mono text-[9px] font-normal text-zinc-500">{children}</kbd>
}
