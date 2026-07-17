"use client"

import {
  ArrowRight,
  Archive,
  Brush,
  Check,
  Circle,
  Copy,
  Crop,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImageIcon,
  Images,
  LoaderCircle,
  MousePointer2,
  Redo2,
  RotateCw,
  ScanLine,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { useImageWorkflowMemory } from "@/components/image-workflow-memory"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { downloadBlob, formatBytes, waitForBrowserPaint } from "@/lib/browser-files"
import { validateImageFile } from "@/lib/file-validation"
import {
  clampEditorCrop,
  editorOutputDimensions,
  editorOutputName,
  getEditorPreviewSize,
  IMAGE_EDITOR_HISTORY_LIMIT,
  IMAGE_EDITOR_MAX_BYTES,
  IMAGE_EDITOR_MAX_PIXELS,
  type EditorExportFormat,
} from "@/lib/image-editor"
import { loadLocalAsset, loadLocalAssetBatch, localAssetBatchFiles, localAssetFile, saveLocalAsset, saveLocalAssetBatch } from "@/lib/local-asset-transfer"
import { cn } from "@/lib/utils"

type FabricNamespace = typeof import("fabric")
type FabricCanvas = import("fabric").Canvas
type FabricImage = import("fabric").FabricImage
type FabricObject = import("fabric").FabricObject
type FabricRect = import("fabric").Rect
type TPointerEvent = import("fabric").TPointerEvent

type EditorRole = "background" | "overlay" | "mosaic" | "crop" | "selection"
type EditorObject = FabricObject & { editorRole?: EditorRole }
type EditorTool = "select" | "draw" | "mosaic" | "crop"
type CropRatio = "free" | "1:1" | "4:3" | "16:9"
type Adjustments = { brightness: number; contrast: number; saturation: number; grayscale: boolean }
type Snapshot = { json: unknown; width: number; height: number }
type EditorQueueItem = { id: string; file: File; previewUrl: string; edited?: { file: File; blob: Blob; previewUrl: string; name: string } }
type StoredEditorQueueItem = Omit<EditorQueueItem, "previewUrl" | "edited"> & { edited?: Omit<NonNullable<EditorQueueItem["edited"]>, "previewUrl"> }
type EditorQueueSnapshot = { items: StoredEditorQueueItem[]; activeId: string }

const defaultAdjustments: Adjustments = { brightness: 100, contrast: 100, saturation: 100, grayscale: false }
const defaultColor = "#f43f5e"
const transparent = "rgba(0,0,0,0)"

export function QuickImageEditor() {
  const { pick, format } = useLanguage()
  const router = useRouter()
  const workflowMemory = useImageWorkflowMemory()
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<EditorQueueItem[]>([])
  const activeIdRef = useRef("")
  const [queue, setQueue] = useState<EditorQueueItem[]>([])
  const [activeId, setActiveId] = useState("")
  const [adding, setAdding] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pasteError, setPasteError] = useState("")
  const [zipping, setZipping] = useState(false)
  const [handingOff, setHandingOff] = useState(false)
  const [restoringHandoff, setRestoringHandoff] = useState(false)
  const handoffAttemptedRef = useRef(false)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  useEffect(() => {
    if (!restoringHandoff) return
    requestAnimationFrame(() => document.getElementById("quick-edit-queue")?.scrollIntoView({ block: "start" }))
  }, [restoringHandoff])

  const replaceQueue = useCallback((update: (items: EditorQueueItem[]) => EditorQueueItem[]) => {
    setQueue((items) => {
      const next = update(items)
      queueRef.current = next
      return next
    })
  }, [])

  const addFiles = useCallback(async (candidates: readonly File[], allowLargeLocalResults = false) => {
    if (!candidates.length || adding) return
    setAdding(true)
    setPasteError("")
    await waitForBrowserPaint()
    const known = new Set(queueRef.current.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`))
    const accepted: EditorQueueItem[] = []
    for (const candidate of candidates) {
      if (queueRef.current.length + accepted.length >= 30) { setPasteError(pick("快速修图队列最多加入 30 张图片。", "The quick-edit queue accepts up to 30 images.")); break }
      const fingerprint = `${candidate.name}:${candidate.size}:${candidate.lastModified}`
      if (known.has(fingerprint)) continue
      try {
        const validated = await validateImageFile(candidate, IMAGE_EDITOR_MAX_PIXELS)
        if (!allowLargeLocalResults && validated.file.size > IMAGE_EDITOR_MAX_BYTES) throw new Error(format("文件不能超过 {size}MB", "File cannot exceed {size}MB", { size: 25 }))
        accepted.push({ id: crypto.randomUUID(), file: validated.file, previewUrl: URL.createObjectURL(validated.file) })
        known.add(fingerprint)
      } catch (reason) {
        setPasteError(reason instanceof Error ? reason.message : pick("无法读取图片", "Unable to read image"))
      }
    }
    if (accepted.length) {
      replaceQueue((items) => [...items, ...accepted])
      setActiveId((current) => current || accepted[0].id)
    }
    setAdding(false)
  }, [adding, format, pick, replaceQueue])

  useEffect(() => {
    if (handoffAttemptedRef.current) return
    handoffAttemptedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const batchId = params.get("batch")
    const assetId = params.get("asset")
    if (!batchId && !assetId) return
    setRestoringHandoff(true)
    void (batchId ? loadLocalAssetBatch(batchId) : loadLocalAsset(assetId!))
      .then(async (record) => {
        if (!record) throw new Error(pick("临时图片队列已过期，请从上一步重新发送。", "The temporary image queue has expired. Send it again from the previous tool."))
        await addFiles("kind" in record ? localAssetBatchFiles(record) : [localAssetFile(record)], Boolean(batchId))
      })
      .catch((reason) => setPasteError(reason instanceof Error ? reason.message : pick("无法读取上一步的图片队列", "Unable to read the image queue from the previous tool")))
      .finally(() => setRestoringHandoff(false))
  }, [addFiles, format, pick])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"))
      if (!pasted) return
      event.preventDefault()
      setPasteError("")
      void addFiles([pasted])
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [addFiles])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    if (!params.has("asset") && !params.has("batch")) {
      const saved = workflowMemory.get<EditorQueueSnapshot>("image-editor")
      if (saved?.items.length) {
        queueMicrotask(() => {
          if (cancelled) return
          const restored = saved.items.map<EditorQueueItem>((item) => ({
            ...item,
            previewUrl: URL.createObjectURL(item.file),
            edited: item.edited ? { ...item.edited, previewUrl: URL.createObjectURL(item.edited.blob) } : undefined,
          }))
          queueRef.current = restored
          setQueue(restored)
          activeIdRef.current = saved.activeId || restored[0].id
          setActiveId(saved.activeId || restored[0].id)
        })
      }
    }
    return () => {
      cancelled = true
      const storedItems = queueRef.current.map<StoredEditorQueueItem>((item) => ({
        id: item.id,
        file: item.file,
        edited: item.edited ? { file: item.edited.file, blob: item.edited.blob, name: item.edited.name } : undefined,
      }))
      if (storedItems.length) workflowMemory.set<EditorQueueSnapshot>("image-editor", { items: storedItems, activeId: activeIdRef.current })
      else workflowMemory.delete("image-editor")
      for (const item of queueRef.current) {
        URL.revokeObjectURL(item.previewUrl)
        if (item.edited) URL.revokeObjectURL(item.edited.previewUrl)
      }
    }
  }, [workflowMemory])

  const active = queue.find((item) => item.id === activeId) ?? queue[0]

  function selectItem(id: string) {
    if (id === activeId) return
    if (dirty && !window.confirm(pick("当前修改尚未保存到队列，确定切换图片吗？", "Current edits are not saved to the queue. Switch images anyway?"))) return
    setDirty(false)
    setActiveId(id)
  }

  function removeItem(id: string) {
    const item = queueRef.current.find((candidate) => candidate.id === id)
    if (!item) return
    URL.revokeObjectURL(item.previewUrl)
    if (item.edited) URL.revokeObjectURL(item.edited.previewUrl)
    const next = queueRef.current.filter((candidate) => candidate.id !== id)
    replaceQueue(() => next)
    if (activeId === id) { setActiveId(next[0]?.id ?? ""); setDirty(false) }
  }

  function saveEdited(id: string, blob: Blob, name: string) {
    const file = new File([blob], name, { type: blob.type || "image/png", lastModified: Date.now() })
    const previewUrl = URL.createObjectURL(blob)
    replaceQueue((items) => items.map((item) => {
      if (item.id !== id) return item
      if (item.edited) URL.revokeObjectURL(item.edited.previewUrl)
      return { ...item, edited: { file, blob, previewUrl, name } }
    }))
    setDirty(false)
  }

  async function downloadAll() {
    const edited = queue.filter((item): item is EditorQueueItem & { edited: NonNullable<EditorQueueItem["edited"]> } => Boolean(item.edited))
    if (!edited.length || zipping) return
    setZipping(true)
    try {
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      for (const item of edited) zip.file(item.edited.name, item.edited.blob)
      downloadBlob(await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }), `tabnative-edited-images-${new Date().toISOString().slice(0, 10)}.zip`)
    } catch { setPasteError(pick("ZIP 打包失败，请逐张下载。", "ZIP creation failed. Download images individually.")) }
    finally { setZipping(false) }
  }

  async function continueToBatchOptimizer() {
    if (!queue.length || handingOff) return
    if (dirty) {
      setPasteError(pick("当前图片还有未保存的修改。请先保存到队列，再继续批量优化。", "The current image has unsaved changes. Save it to the queue before continuing to batch optimization."))
      return
    }
    setHandingOff(true)
    setPasteError("")
    try {
      const batchId = await saveLocalAssetBatch(queue.map((item) => ({
        blob: item.edited?.blob ?? item.file,
        name: item.edited?.name ?? item.file.name,
      })), "image-editor")
      router.push(`/image-compressor?batch=${encodeURIComponent(batchId)}`)
    } catch {
      setPasteError(pick("无法把当前队列交给批量优化。请减少图片数量或文件总大小后重试。", "The queue could not be passed to batch optimization. Reduce the number or total size of the images and try again."))
      setHandingOff(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card id="quick-edit-queue" className="scroll-mt-24 border-white/10 bg-[#0d0d0d] text-zinc-100 shadow-none">
        <CardHeader><CardTitle className="flex items-center gap-2"><Images className="size-5 text-cyan-300" />{pick("快速修图队列", "Quick-edit queue")}</CardTitle><p className="text-sm leading-6 text-zinc-500">{pick("一次加入多张图片，点击队列项逐张编辑；保存到队列后再切换下一张。", "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.")}</p></CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={adding || restoringHandoff}><Upload />{adding || restoringHandoff ? pick("正在检查图片", "Checking images") : pick("添加图片", "Add images")}</Button>
          <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = "" }} />
          {restoringHandoff ? <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-cyan-300/30 bg-cyan-300/[.08] px-4 py-3 text-sm text-zinc-200"><LoaderCircle className="size-5 shrink-0 animate-spin text-cyan-300" /><strong>{pick("正在恢复上一步的图片队列", "Loading the local image from the previous tool and validating its contents")}</strong></div> : null}
          {adding ? <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-cyan-300/30 bg-cyan-300/[.08] px-4 py-3 text-sm text-zinc-200"><LoaderCircle className="size-5 shrink-0 animate-spin text-cyan-300" /><span><strong>{pick("图片正在加入修图队列", "Adding images to the editing queue")}</strong><span className="ml-2 text-zinc-500">{pick("正在逐张读取并校验，请稍候；完成后会自动显示缩略图。", "Reading and validating images one at a time. Thumbnails will appear automatically when ready.")}</span></span></div> : null}
          {queue.length ? <div className="flex gap-3 overflow-x-auto pb-2">{queue.map((item, index) => <button key={item.id} type="button" onClick={() => selectItem(item.id)} className={cn("w-28 shrink-0 overflow-hidden rounded-xl border p-2 text-left transition", item.id === active?.id ? "border-cyan-300 bg-cyan-300/[.08]" : "border-white/10 bg-white/[.025] hover:border-white/25")}>
            <span className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-black/30">
              {/* Blob URLs are local queue previews and cannot be optimized by next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.edited?.previewUrl ?? item.previewUrl} alt={format("第 {index} 张图片预览", "Preview of image {index}", { index: index + 1 })} className="size-full object-contain" />
              {item.edited ? <span className="absolute right-1 top-1 rounded bg-emerald-400 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-950">{pick("已保存", "Saved")}</span> : null}
            </span><span className="mt-2 block truncate text-xs text-zinc-300">{item.file.name}</span>
          </button>)}</div> : <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-white/10 text-center text-sm text-zinc-500">{pick("添加图片后，点击缩略图开始编辑。", "Add images, then select a thumbnail to start editing.")}</div>}
          <div className="flex flex-wrap gap-2">{queue.filter((item) => item.edited).map((item) => <Button key={item.id} size="sm" variant="ghost" onClick={() => item.edited && downloadBlob(item.edited.blob, item.edited.name)}><Download />{item.file.name}</Button>)}{queue.some((item) => item.edited) ? <Button size="sm" variant="outline" onClick={() => void downloadAll()} disabled={zipping || handingOff}>{zipping ? <LoaderCircle className="animate-spin" /> : <Archive />}{pick("下载已编辑 ZIP", "Download edited ZIP")}</Button> : null}</div>
          {queue.length ? <div className="flex flex-col gap-3 rounded-xl border border-cyan-300/25 bg-cyan-300/[.055] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-zinc-100">{pick("下一步：批量优化与交付", "Next: batch optimization and delivery")}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{pick("已保存的修图结果会优先进入下一步，未编辑图片会保持当前版本。", "Saved edits continue to the next step; unedited images keep their current version.")}</p></div><Button className="shrink-0" disabled={handingOff} onClick={() => void continueToBatchOptimizer()}>{handingOff ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{handingOff ? pick("处理中", "Processing") : format("继续批量优化（{count} 张）", "Continue to batch optimization ({count})", { count: queue.length })}</Button></div> : null}
          {pasteError ? <p role="alert" className="text-sm text-red-400">{pasteError}</p> : null}
          <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[.14em] text-zinc-600"><span>JPG</span><span>PNG</span><span>WEBP</span><span>·</span><span>{pick("最多 30 张 / 每张 25MB", "Up to 30 images / 25MB each")}</span></div>
        </CardContent>
      </Card>
      {active ? <FabricWorkspace key={`${active.id}:${active.edited?.file.lastModified ?? 0}`} file={active.edited?.file ?? active.file} outputNameSource={active.file.name} onReplace={() => { if (!dirty || window.confirm(pick("当前修改尚未保存，确定移出队列吗？", "Current edits are not saved. Remove this image from the queue?"))) removeItem(active.id) }} onSaveToQueue={(blob, name) => saveEdited(active.id, blob, name)} onDirtyChange={setDirty} queueMode /> : null}
    </div>
  )
}

function FabricWorkspace({ file, outputNameSource, onReplace, onSaveToQueue, onDirtyChange, queueMode = false }: { file: File; outputNameSource?: string; onReplace: () => void; onSaveToQueue?: (blob: Blob, name: string) => void; onDirtyChange?: (dirty: boolean) => void; queueMode?: boolean }) {
  const { language, pick } = useLanguage()
  const router = useRouter()
  const canvasElementRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<FabricNamespace | null>(null)
  const canvasRef = useRef<FabricCanvas | null>(null)
  const backgroundRef = useRef<FabricImage | null>(null)
  const cropRef = useRef<FabricRect | null>(null)
  const sourceUrlRef = useRef("")
  const sourceScaleRef = useRef(1)
  const activeToolRef = useRef<EditorTool>("select")
  const zoomRef = useRef(1)
  const colorRef = useRef(defaultColor)
  const strokeWidthRef = useRef(6)
  const pickRef = useRef(pick)
  const adjustmentRef = useRef<Adjustments>(defaultAdjustments)
  const historyRef = useRef({ entries: [] as string[], index: -1, restoring: false })
  const mosaicDragRef = useRef<{ start: { x: number; y: number }; rect: FabricRect } | null>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [activeTool, setActiveTool] = useState<EditorTool>("select")
  const [cropRatio, setCropRatio] = useState<CropRatio>("free")
  const [zoom, setZoom] = useState(1)
  const [hasSelection, setHasSelection] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [color, setColor] = useState(defaultColor)
  const [strokeWidth, setStrokeWidth] = useState(6)
  const [fontSize, setFontSize] = useState(42)
  const [opacity, setOpacity] = useState(100)
  const [adjustments, setAdjustments] = useState<Adjustments>(defaultAdjustments)
  const [exportFormat, setExportFormat] = useState<EditorExportFormat>("image/png")
  const [quality, setQuality] = useState(90)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ size: number; width: number; height: number; destination: "download" | "queue" } | null>(null)

  useEffect(() => { pickRef.current = pick }, [pick])

  const updateHistoryAvailability = useCallback(() => {
    const history = historyRef.current
    setCanUndo(history.index > 0)
    setCanRedo(history.index >= 0 && history.index < history.entries.length - 1)
  }, [])

  const snapshotCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return ""
    const snapshot: Snapshot = { json: canvas.toJSON(), width: canvas.width, height: canvas.height }
    return JSON.stringify(snapshot)
  }, [])

  const commitHistory = useCallback(() => {
    const history = historyRef.current
    if (history.restoring || cropRef.current || mosaicDragRef.current) return
    const snapshot = snapshotCanvas()
    if (!snapshot || history.entries[history.index] === snapshot) return
    history.entries = history.entries.slice(0, history.index + 1)
    history.entries.push(snapshot)
    if (history.entries.length > IMAGE_EDITOR_HISTORY_LIMIT) history.entries.shift()
    history.index = history.entries.length - 1
    updateHistoryAvailability()
    onDirtyChange?.(history.index > 0)
  }, [onDirtyChange, snapshotCanvas, updateHistoryAvailability])

  const applyDisplayScale = useCallback(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage || !canvas.width || !canvas.height) return
    const availableWidth = Math.max(280, stage.clientWidth - 32)
    const availableHeight = Math.max(360, Math.min(720, window.innerHeight * .68))
    const fit = Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height)
    const displayScale = Math.max(.08, fit * zoomRef.current)
    canvas.setDimensions({
      width: `${Math.round(canvas.width * displayScale)}px`,
      height: `${Math.round(canvas.height * displayScale)}px`,
    }, { cssOnly: true })
    const wrapper = (canvas as FabricCanvas & { wrapperEl?: HTMLElement }).wrapperEl
    if (wrapper) {
      wrapper.style.margin = "auto"
      wrapper.style.flex = "none"
    }
  }, [])

  const syncAdjustmentsFromBackground = useCallback(() => {
    const next = { ...defaultAdjustments }
    for (const filter of backgroundRef.current?.filters ?? []) {
      const value = filter as unknown as { type?: string; brightness?: number; contrast?: number; saturation?: number }
      if (value.type === "Brightness") next.brightness = Math.round(100 + (value.brightness ?? 0) * 100)
      if (value.type === "Contrast") next.contrast = Math.round(100 + (value.contrast ?? 0) * 100)
      if (value.type === "Saturation") next.saturation = Math.round(100 + (value.saturation ?? 0) * 100)
      if (value.type === "Grayscale") next.grayscale = true
    }
    adjustmentRef.current = next
    setAdjustments(next)
  }, [])

  const restoreSnapshot = useCallback(async (serialized: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const history = historyRef.current
    const snapshot = JSON.parse(serialized) as Snapshot
    history.restoring = true
    setError("")
    try {
      canvas.discardActiveObject()
      await canvas.loadFromJSON(snapshot.json as Record<string, unknown>)
      canvas.setDimensions({ width: snapshot.width, height: snapshot.height })
      canvas.backgroundColor = "transparent"
      backgroundRef.current = canvas.getObjects().find((object) => (object as EditorObject).editorRole === "background") as FabricImage | undefined ?? null
      cropRef.current = null
      setHasSelection(false)
      syncAdjustmentsFromBackground()
      canvas.requestRenderAll()
      applyDisplayScale()
    } catch {
      setError(pick("无法恢复这一步编辑，请重置后重试。", "This edit could not be restored. Reset and try again."))
    } finally {
      history.restoring = false
    }
  }, [applyDisplayScale, pick, syncAdjustmentsFromBackground])

  const moveHistory = useCallback(async (direction: -1 | 1) => {
    const history = historyRef.current
    const nextIndex = history.index + direction
    if (nextIndex < 0 || nextIndex >= history.entries.length || history.restoring) return
    history.index = nextIndex
    updateHistoryAvailability()
    await restoreSnapshot(history.entries[nextIndex])
  }, [restoreSnapshot, updateHistoryAvailability])

  const setObjectRole = useCallback((object: FabricObject, role: EditorRole) => {
    ;(object as EditorObject).editorRole = role
  }, [])

  const selectCanvasTool = useCallback((tool: EditorTool) => {
    const canvas = canvasRef.current
    const fabric = fabricRef.current
    if (!canvas || !fabric) return
    activeToolRef.current = tool
    setActiveTool(tool)
    canvas.isDrawingMode = tool === "draw"
    canvas.selection = tool === "select" || tool === "crop"
    canvas.defaultCursor = tool === "mosaic" ? "crosshair" : "default"
    if (tool === "draw") {
      const brush = new fabric.PencilBrush(canvas)
      brush.color = colorRef.current
      brush.width = strokeWidthRef.current
      canvas.freeDrawingBrush = brush
      canvas.discardActiveObject()
      setHasSelection(false)
    }
    canvas.requestRenderAll()
  }, [])

  const cancelCrop = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas && cropRef.current) canvas.remove(cropRef.current)
    cropRef.current = null
    selectCanvasTool("select")
  }, [selectCanvasTool])

  const createCropSelection = useCallback((ratio: CropRatio) => {
    const canvas = canvasRef.current
    const fabric = fabricRef.current
    if (!canvas || !fabric) return
    if (cropRef.current) canvas.remove(cropRef.current)
    const padding = Math.max(18, Math.min(canvas.width, canvas.height) * .08)
    let width = Math.max(40, canvas.width - padding * 2)
    let height = Math.max(40, canvas.height - padding * 2)
    if (ratio !== "free") {
      const [rw, rh] = ratio.split(":").map(Number)
      const target = rw / rh
      if (width / height > target) width = height * target
      else height = width / target
    }
    const crop = new fabric.Rect({
      left: (canvas.width - width) / 2,
      top: (canvas.height - height) / 2,
      originX: "left",
      originY: "top",
      width,
      height,
      fill: "rgba(8,145,178,.08)",
      stroke: "#67e8f9",
      strokeWidth: Math.max(2, canvas.width / 800),
      strokeDashArray: [12, 8],
      transparentCorners: false,
      cornerColor: "#67e8f9",
      cornerStrokeColor: "#083344",
      borderColor: "#67e8f9",
      lockRotation: true,
    })
    setObjectRole(crop, "crop")
    cropRef.current = crop
    canvas.add(crop)
    canvas.setActiveObject(crop)
    canvas.requestRenderAll()
  }, [setObjectRole])

  const startCrop = useCallback(() => {
    selectCanvasTool("crop")
    createCropSelection(cropRatio)
  }, [createCropSelection, cropRatio, selectCanvasTool])

  const applyCrop = useCallback(() => {
    const canvas = canvasRef.current
    const fabric = fabricRef.current
    const crop = cropRef.current
    if (!canvas || !fabric || !crop) return
    const bounds = clampEditorCrop(crop.getBoundingRect(), canvas.width, canvas.height)
    if (bounds.width < 16 || bounds.height < 16) {
      setError(pick("裁剪区域太小，请放大选区。", "The crop area is too small. Enlarge the selection."))
      return
    }
    canvas.remove(crop)
    cropRef.current = null
    for (const object of canvas.getObjects()) {
      const center = object.getCenterPoint()
      object.setPositionByOrigin(new fabric.Point(center.x - bounds.left, center.y - bounds.top), "center", "center")
      object.setCoords()
    }
    canvas.setDimensions({ width: bounds.width, height: bounds.height })
    selectCanvasTool("select")
    canvas.requestRenderAll()
    applyDisplayScale()
    commitHistory()
  }, [applyDisplayScale, commitHistory, pick, selectCanvasTool])

  const syncSelection = useCallback((object?: FabricObject | null) => {
    const selected = object ?? canvasRef.current?.getActiveObject()
    const role = (selected as EditorObject | undefined)?.editorRole
    const usable = Boolean(selected && role !== "background" && role !== "crop" && role !== "selection")
    setHasSelection(usable)
    if (!usable || !selected) return
    setOpacity(Math.round((selected.opacity ?? 1) * 100))
    const selectedAny = selected as FabricObject & { fill?: unknown; stroke?: unknown; strokeWidth?: number; fontSize?: number }
    const candidate = typeof selectedAny.fill === "string" && selectedAny.fill !== transparent
      ? selectedAny.fill
      : typeof selectedAny.stroke === "string" ? selectedAny.stroke : ""
    if (/^#[0-9a-f]{6}$/i.test(candidate)) {
      colorRef.current = candidate
      setColor(candidate)
    }
    if (selectedAny.strokeWidth) {
      strokeWidthRef.current = Math.round(selectedAny.strokeWidth)
      setStrokeWidth(strokeWidthRef.current)
    }
    if (selectedAny.fontSize) setFontSize(Math.round(selectedAny.fontSize))
  }, [])

  useEffect(() => {
    let active = true
    const abortController = new AbortController()
    let resizeObserver: ResizeObserver | null = null

    async function initialize() {
      try {
        const validated = await validateImageFile(file, IMAGE_EDITOR_MAX_PIXELS)
        const fabric = await import("fabric")
        if (!active || !canvasElementRef.current) return
        fabric.FabricObject.customProperties = Array.from(new Set([...fabric.FabricObject.customProperties, "editorRole"]))
        fabricRef.current = fabric

        const canvas = new fabric.Canvas(canvasElementRef.current, {
          backgroundColor: "transparent",
          preserveObjectStacking: true,
          selectionColor: "rgba(103,232,249,.08)",
          selectionBorderColor: "#67e8f9",
        })
        canvasRef.current = canvas
        const preview = getEditorPreviewSize(validated.width, validated.height)
        sourceScaleRef.current = preview.sourceScale
        canvas.setDimensions({ width: preview.width, height: preview.height })

        const sourceUrl = URL.createObjectURL(validated.file)
        sourceUrlRef.current = sourceUrl
        const image = await fabric.FabricImage.fromURL(sourceUrl, { signal: abortController.signal })
        if (!active) return
        image.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          scaleX: preview.width / Math.max(1, image.width),
          scaleY: preview.height / Math.max(1, image.height),
          selectable: false,
          evented: false,
          objectCaching: false,
        })
        setObjectRole(image, "background")
        backgroundRef.current = image
        canvas.add(image)
        canvas.sendObjectToBack(image)

        canvas.on("selection:created", (event) => syncSelection(event.selected?.[0]))
        canvas.on("selection:updated", (event) => syncSelection(event.selected?.[0]))
        canvas.on("selection:cleared", () => setHasSelection(false))
        canvas.on("object:modified", () => commitHistory())
        canvas.on("text:editing:exited", () => commitHistory())
        canvas.on("path:created", (event) => {
          if (event.path) setObjectRole(event.path, "overlay")
          commitHistory()
        })

        canvas.on("mouse:down", (event) => {
          if (activeToolRef.current !== "mosaic" || !event.e) return
          const point = canvas.getScenePoint(event.e as TPointerEvent)
          const rect = new fabric.Rect({ left: point.x, top: point.y, originX: "left", originY: "top", width: 1, height: 1, fill: "rgba(103,232,249,.14)", stroke: "#67e8f9", strokeWidth: 2, selectable: false, evented: false })
          setObjectRole(rect, "selection")
          mosaicDragRef.current = { start: point, rect }
          canvas.add(rect)
        })
        canvas.on("mouse:move", (event) => {
          const drag = mosaicDragRef.current
          if (!drag || !event.e) return
          const point = canvas.getScenePoint(event.e as TPointerEvent)
          drag.rect.set({
            left: Math.min(drag.start.x, point.x),
            top: Math.min(drag.start.y, point.y),
            width: Math.abs(point.x - drag.start.x),
            height: Math.abs(point.y - drag.start.y),
          })
          drag.rect.setCoords()
          canvas.requestRenderAll()
        })
        canvas.on("mouse:up", () => {
          const drag = mosaicDragRef.current
          if (!drag) return
          mosaicDragRef.current = null
          const bounds = clampEditorCrop(drag.rect.getBoundingRect(), canvas.width, canvas.height)
          canvas.remove(drag.rect)
          canvas.requestRenderAll()
          if (bounds.width >= 8 && bounds.height >= 8) {
            const snapshot = canvas.toCanvasElement(1)
            const blockSize = Math.max(8, Math.round(Math.min(bounds.width, bounds.height) / 16))
            const pixelCanvas = document.createElement("canvas")
            pixelCanvas.width = Math.max(1, Math.ceil(bounds.width / blockSize))
            pixelCanvas.height = Math.max(1, Math.ceil(bounds.height / blockSize))
            const context = pixelCanvas.getContext("2d")
            context?.drawImage(snapshot, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, pixelCanvas.width, pixelCanvas.height)
            const mosaic = new fabric.FabricImage(pixelCanvas, {
              left: bounds.left,
              top: bounds.top,
              originX: "left",
              originY: "top",
              scaleX: bounds.width / pixelCanvas.width,
              scaleY: bounds.height / pixelCanvas.height,
              imageSmoothing: false,
              transparentCorners: false,
              cornerColor: "#67e8f9",
              borderColor: "#67e8f9",
            })
            setObjectRole(mosaic, "mosaic")
            canvas.add(mosaic)
            canvas.setActiveObject(mosaic)
            syncSelection(mosaic)
            commitHistory()
          }
          selectCanvasTool("select")
        })

        historyRef.current = { entries: [], index: -1, restoring: false }
        commitHistory()
        setReady(true)
        applyDisplayScale()
        resizeObserver = new ResizeObserver(() => applyDisplayScale())
        if (stageRef.current) resizeObserver.observe(stageRef.current)
      } catch (reason) {
        if (!abortController.signal.aborted) setError(reason instanceof Error ? reason.message : pickRef.current("图片编辑器启动失败。", "The image editor could not start."))
      }
    }

    void initialize()
    return () => {
      active = false
      abortController.abort()
      resizeObserver?.disconnect()
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = ""
      const canvas = canvasRef.current
      canvasRef.current = null
      backgroundRef.current = null
      if (canvas) void canvas.dispose()
    }
  }, [applyDisplayScale, commitHistory, file, selectCanvasTool, setObjectRole, syncSelection])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        void moveHistory(event.shiftKey ? 1 : -1)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault()
        void moveHistory(1)
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        removeSelected()
      }
      if (event.key === "Escape") cancelCrop()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  function addObject(kind: "text" | "rect" | "circle" | "arrow") {
    const canvas = canvasRef.current
    const fabric = fabricRef.current
    if (!canvas || !fabric) return
    cancelCrop()
    const common = { transparentCorners: false, cornerColor: "#67e8f9", cornerStrokeColor: "#083344", borderColor: "#67e8f9", strokeUniform: true }
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    let object: FabricObject
    if (kind === "text") {
      object = new fabric.IText(pick("双击编辑文字", "Double-click to edit"), {
        ...common,
        left: centerX,
        top: centerY,
        originX: "center",
        originY: "center",
        fill: color,
        fontSize,
        fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif",
        direction: language === "ar" ? "rtl" : "ltr",
        textAlign: language === "ar" ? "right" : "left",
      })
    } else if (kind === "rect") {
      object = new fabric.Rect({ ...common, left: centerX, top: centerY, originX: "center", originY: "center", width: Math.min(300, canvas.width * .34), height: Math.min(190, canvas.height * .24), fill: transparent, stroke: color, strokeWidth })
    } else if (kind === "circle") {
      const radius = Math.min(120, canvas.width * .14, canvas.height * .14)
      object = new fabric.Circle({ ...common, left: centerX, top: centerY, originX: "center", originY: "center", radius, fill: transparent, stroke: color, strokeWidth })
    } else {
      const length = Math.min(260, canvas.width * .3)
      const line = new fabric.Line([0, 0, length, 0], { stroke: color, strokeWidth, strokeLineCap: "round" })
      const head = new fabric.Triangle({ left: length, top: 0, originX: "center", originY: "center", width: strokeWidth * 4, height: strokeWidth * 5, fill: color, angle: 90 })
      object = new fabric.Group([line, head], { ...common, left: centerX, top: centerY, originX: "center", originY: "center" })
    }
    setObjectRole(object, "overlay")
    canvas.add(object)
    canvas.setActiveObject(object)
    syncSelection(object)
    selectCanvasTool("select")
    canvas.requestRenderAll()
    commitHistory()
  }

  function removeSelected() {
    const canvas = canvasRef.current
    const selected = canvas?.getActiveObject()
    const role = (selected as EditorObject | undefined)?.editorRole
    if (!canvas || !selected || role === "background" || role === "crop") return
    canvas.remove(selected)
    canvas.discardActiveObject()
    setHasSelection(false)
    canvas.requestRenderAll()
    commitHistory()
  }

  async function duplicateSelected() {
    const canvas = canvasRef.current
    const selected = canvas?.getActiveObject()
    const role = (selected as EditorObject | undefined)?.editorRole
    if (!canvas || !selected || role === "background" || role === "crop") return
    const clone = await selected.clone()
    clone.set({ left: (selected.left ?? 0) + 24, top: (selected.top ?? 0) + 24 })
    setObjectRole(clone, role ?? "overlay")
    canvas.add(clone)
    canvas.setActiveObject(clone)
    syncSelection(clone)
    canvas.requestRenderAll()
    commitHistory()
  }

  function updateSelectedStyle(next: { color?: string; strokeWidth?: number; fontSize?: number; opacity?: number }, save = false) {
    const canvas = canvasRef.current
    const selected = canvas?.getActiveObject()
    if (!canvas || !selected) return
    const type = selected.type.toLowerCase()
    if (next.opacity !== undefined) selected.set("opacity", next.opacity / 100)
    if (next.fontSize !== undefined && (type.includes("text") || type.includes("i-text"))) selected.set("fontSize" as never, next.fontSize as never)
    if (next.color) {
      if (type.includes("text")) selected.set("fill", next.color)
      else if (type === "path") selected.set("stroke", next.color)
      else if (type === "group") {
        for (const child of (selected as import("fabric").Group).getObjects()) {
          if (child.type === "Triangle") child.set("fill", next.color)
          else child.set("stroke", next.color)
        }
      } else selected.set("stroke", next.color)
      if (canvas.isDrawingMode && canvas.freeDrawingBrush) canvas.freeDrawingBrush.color = next.color
    }
    if (next.strokeWidth !== undefined) {
      if (type === "group") {
        for (const child of (selected as import("fabric").Group).getObjects()) child.set("strokeWidth", next.strokeWidth)
      } else selected.set("strokeWidth", next.strokeWidth)
      if (canvas.isDrawingMode && canvas.freeDrawingBrush) canvas.freeDrawingBrush.width = next.strokeWidth
    }
    selected.setCoords()
    canvas.requestRenderAll()
    if (save) commitHistory()
  }

  function applyAdjustments(next: Adjustments, save = false) {
    const fabric = fabricRef.current
    const canvas = canvasRef.current
    const image = backgroundRef.current
    if (!fabric || !canvas || !image) return
    adjustmentRef.current = next
    setAdjustments(next)
    const activeFilters: import("fabric").filters.BaseFilter<string, Record<string, unknown>>[] = []
    if (next.brightness !== 100) activeFilters.push(new fabric.filters.Brightness({ brightness: (next.brightness - 100) / 100 }))
    if (next.contrast !== 100) activeFilters.push(new fabric.filters.Contrast({ contrast: (next.contrast - 100) / 100 }))
    if (next.saturation !== 100) activeFilters.push(new fabric.filters.Saturation({ saturation: (next.saturation - 100) / 100 }))
    if (next.grayscale) activeFilters.push(new fabric.filters.Grayscale())
    image.filters = activeFilters
    image.applyFilters()
    canvas.requestRenderAll()
    if (save) commitHistory()
  }

  function rotateClockwise() {
    const canvas = canvasRef.current
    const fabric = fabricRef.current
    if (!canvas || !fabric) return
    cancelCrop()
    const oldWidth = canvas.width
    const oldHeight = canvas.height
    for (const object of canvas.getObjects()) {
      const center = object.getCenterPoint()
      object.rotate((object.angle ?? 0) + 90)
      object.setPositionByOrigin(new fabric.Point(oldHeight - center.y, center.x), "center", "center")
      object.setCoords()
    }
    canvas.setDimensions({ width: oldHeight, height: oldWidth })
    canvas.requestRenderAll()
    applyDisplayScale()
    commitHistory()
  }

  function flipScene(axis: "x" | "y") {
    const canvas = canvasRef.current
    const fabric = fabricRef.current
    if (!canvas || !fabric) return
    cancelCrop()
    for (const object of canvas.getObjects()) {
      const center = object.getCenterPoint()
      const isText = object.type.toLowerCase().includes("text")
      if (axis === "x") {
        object.setPositionByOrigin(new fabric.Point(canvas.width - center.x, center.y), "center", "center")
        if (!isText) object.set("flipX", !object.flipX)
      } else {
        object.setPositionByOrigin(new fabric.Point(center.x, canvas.height - center.y), "center", "center")
        if (!isText) object.set("flipY", !object.flipY)
      }
      object.setCoords()
    }
    canvas.requestRenderAll()
    commitHistory()
  }

  function setZoomValue(next: number) {
    const value = Math.max(.5, Math.min(2.5, next))
    zoomRef.current = value
    setZoom(value)
    applyDisplayScale()
  }

  async function resetAll() {
    const initial = historyRef.current.entries[0]
    if (!initial) return
    cancelCrop()
    await restoreSnapshot(initial)
    commitHistory()
    onDirtyChange?.(false)
  }

  async function exportImage(destination: "download" | "optimizer" | "queue" = "download") {
    const canvas = canvasRef.current
    if (!canvas || cropRef.current) return
    setExporting(true)
    setError("")
    setExportResult(null)
    try {
      canvas.discardActiveObject()
      const previousBackground = canvas.backgroundColor
      canvas.backgroundColor = exportFormat === "image/jpeg" ? "#ffffff" : "transparent"
      canvas.requestRenderAll()
      const format = exportFormat === "image/jpeg" ? "jpeg" : exportFormat === "image/webp" ? "webp" : "png"
      const blob = await canvas.toBlob({ format, quality: quality / 100, multiplier: sourceScaleRef.current, enableRetinaScaling: false })
      canvas.backgroundColor = previousBackground
      canvas.requestRenderAll()
      if (!blob) throw new Error(pick("浏览器无法编码结果。", "The browser could not encode the result."))
      const dimensions = editorOutputDimensions(canvas.width, canvas.height, sourceScaleRef.current)
      const outputName = editorOutputName(outputNameSource ?? file.name, exportFormat)
      if (destination === "optimizer") {
        const assetId = await saveLocalAsset(blob, outputName, "image-editor")
        router.push(`/image-compressor?asset=${encodeURIComponent(assetId)}`)
        return
      }
      if (destination === "queue" && onSaveToQueue) {
        onSaveToQueue(blob, outputName)
        onDirtyChange?.(false)
        setExportResult({ size: blob.size, ...dimensions, destination: "queue" })
        return
      }
      downloadBlob(blob, outputName)
      setExportResult({ size: blob.size, ...dimensions, destination: "download" })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : pick("导出失败，请降低图片尺寸后重试。", "Export failed. Reduce the image size and try again."))
    } finally {
      setExporting(false)
    }
  }

  const setRatio = (next: CropRatio) => {
    setCropRatio(next)
    if (cropRef.current) createCropSelection(next)
  }

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-[#0d0d0d] py-0 text-zinc-100 shadow-none">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <Button variant="ghost" size="sm" onClick={() => void moveHistory(-1)} disabled={!canUndo} title={pick("撤销", "Undo")}><Undo2 />{pick("撤销", "Undo")}</Button>
          <Button variant="ghost" size="sm" onClick={() => void moveHistory(1)} disabled={!canRedo} title={pick("重做", "Redo")}><Redo2 />{pick("重做", "Redo")}</Button>
          <span className="mx-1 h-6 w-px bg-white/10" />
          <Button variant="ghost" size="icon-sm" onClick={() => setZoomValue(zoom - .25)} aria-label={pick("缩小", "Zoom out")}><ZoomOut /></Button>
          <button type="button" className="min-w-14 font-mono text-xs text-zinc-400" onClick={() => setZoomValue(1)} title={pick("适应窗口", "Fit to window")}>{Math.round(zoom * 100)}%</button>
          <Button variant="ghost" size="icon-sm" onClick={() => setZoomValue(zoom + .25)} aria-label={pick("放大", "Zoom in")}><ZoomIn /></Button>
          <span className="mx-1 h-6 w-px bg-white/10" />
          <Button variant="ghost" size="sm" onClick={rotateClockwise}><RotateCw />{pick("旋转", "Rotate")}</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => flipScene("x")} aria-label={pick("水平翻转", "Flip horizontally")} title={pick("水平翻转", "Flip horizontally")}><FlipHorizontal2 /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => flipScene("y")} aria-label={pick("垂直翻转", "Flip vertically")} title={pick("垂直翻转", "Flip vertically")}><FlipVertical2 /></Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onReplace}><ImageIcon />{queueMode ? pick("移出队列", "Remove from queue") : pick("更换图片", "Replace image")}</Button>
            {onSaveToQueue ? <Button variant="outline" size="sm" onClick={() => void exportImage("queue")} disabled={!ready || exporting || Boolean(cropRef.current)}><Check />{pick("保存到队列", "Save to queue")}</Button> : null}
            <Button size="sm" onClick={() => void exportImage()} disabled={!ready || exporting || Boolean(cropRef.current)}>{exporting ? <LoaderCircle className="animate-spin" /> : <Download />}{exporting ? pick("正在导出", "Exporting") : pick("导出图片", "Export image")}</Button>
          </div>
        </div>

        {activeTool === "crop" ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-cyan-300/20 bg-cyan-300/[.04] px-3 py-2">
            <span className="text-xs font-medium text-cyan-200">{pick("裁剪比例", "Crop ratio")}</span>
            {(["free", "1:1", "4:3", "16:9"] as CropRatio[]).map((ratio) => <Button key={ratio} size="xs" variant={cropRatio === ratio ? "default" : "outline"} onClick={() => setRatio(ratio)}>{ratio === "free" ? pick("自由", "Free") : ratio}</Button>)}
            <span className="ml-auto flex gap-2"><Button size="sm" onClick={applyCrop}><Check />{pick("应用裁剪", "Apply crop")}</Button><Button size="sm" variant="ghost" onClick={cancelCrop}><X />{pick("取消", "Cancel")}</Button></span>
          </div>
        ) : null}

        <div className="grid min-h-[620px] lg:grid-cols-[176px_minmax(0,1fr)_244px]">
          <aside className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[.16em] text-zinc-600">{pick("编辑工具", "Edit tools")}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-2">
              <ToolButton active={activeTool === "select"} icon={MousePointer2} label={pick("选择", "Select")} onClick={() => { cancelCrop(); selectCanvasTool("select") }} />
              <ToolButton active={activeTool === "crop"} icon={Crop} label={pick("裁剪", "Crop")} onClick={startCrop} />
              <ToolButton icon={Type} label={pick("文字", "Text")} onClick={() => addObject("text")} />
              <ToolButton icon={Square} label={pick("矩形", "Rectangle")} onClick={() => addObject("rect")} />
              <ToolButton icon={Circle} label={pick("圆形", "Circle")} onClick={() => addObject("circle")} />
              <ToolButton icon={ArrowRight} label={pick("箭头", "Arrow")} onClick={() => addObject("arrow")} />
              <ToolButton active={activeTool === "draw"} icon={Brush} label={pick("画笔", "Brush")} onClick={() => { cancelCrop(); selectCanvasTool("draw") }} />
              <ToolButton active={activeTool === "mosaic"} icon={ScanLine} label={pick("马赛克", "Mosaic")} onClick={() => { cancelCrop(); selectCanvasTool("mosaic") }} />
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[.025] p-3 text-xs leading-5 text-zinc-500">
              {activeTool === "mosaic" ? pick("在图片上拖出需要打码的区域。", "Drag across the area you want to pixelate.") : activeTool === "draw" ? pick("直接在图片上绘制；返回“选择”可移动已有对象。", "Draw on the image; return to Select to move existing objects.") : pick("选中对象后可拖动、缩放、旋转或删除。", "Select an object to move, resize, rotate, or delete it.")}
            </div>
          </aside>

          <main ref={stageRef} className="relative flex min-h-[460px] items-center justify-center overflow-auto bg-[#080808] p-4 [background-image:radial-gradient(circle_at_center,rgba(103,232,249,.05),transparent_54%)]">
            {!ready ? <div className="absolute inset-0 z-10 grid place-items-center bg-[#080808]/90"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-cyan-300" /><p className="mt-3 text-sm text-zinc-400">{pick("正在准备本地编辑器", "Preparing the local editor")}</p></div></div> : null}
            <canvas ref={canvasElementRef} aria-label={pick("图片编辑画布", "Image editing canvas")} />
          </main>

          <aside className="space-y-5 border-t border-white/10 p-4 lg:border-l lg:border-t-0">
            <section>
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-zinc-600">{pick("对象样式", "Object style")}</p>
              <div className={cn("mt-3 space-y-3", !hasSelection && "opacity-55")}>
                <Field label={pick("颜色", "Color")}><Input type="color" value={color} disabled={!hasSelection && activeTool !== "draw"} onChange={(event) => { colorRef.current = event.target.value; setColor(event.target.value); updateSelectedStyle({ color: event.target.value }, true) }} /></Field>
                <RangeField label={pick("线条粗细", "Stroke width")} value={strokeWidth} suffix="px"><Input type="range" min="2" max="32" value={strokeWidth} onChange={(event) => { const value = Number(event.target.value); strokeWidthRef.current = value; setStrokeWidth(value); updateSelectedStyle({ strokeWidth: value }) }} onPointerUp={() => commitHistory()} onKeyUp={() => commitHistory()} /></RangeField>
                <RangeField label={pick("文字大小", "Font size")} value={fontSize} suffix="px"><Input type="range" min="16" max="144" value={fontSize} disabled={!hasSelection} onChange={(event) => { const value = Number(event.target.value); setFontSize(value); updateSelectedStyle({ fontSize: value }) }} onPointerUp={() => commitHistory()} onKeyUp={() => commitHistory()} /></RangeField>
                <RangeField label={pick("不透明度", "Opacity")} value={opacity} suffix="%"><Input type="range" min="10" max="100" value={opacity} disabled={!hasSelection} onChange={(event) => { const value = Number(event.target.value); setOpacity(value); updateSelectedStyle({ opacity: value }) }} onPointerUp={() => commitHistory()} onKeyUp={() => commitHistory()} /></RangeField>
                <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" disabled={!hasSelection} onClick={() => void duplicateSelected()}><Copy />{pick("复制", "Duplicate")}</Button><Button size="sm" variant="destructive" disabled={!hasSelection} onClick={removeSelected}><Trash2 />{pick("删除", "Delete")}</Button></div>
              </div>
            </section>

            <section className="border-t border-white/10 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-zinc-600">{pick("基础调色", "Basic adjustments")}</p>
              <div className="mt-3 space-y-3">
                <RangeField label={pick("亮度", "Brightness")} value={adjustments.brightness} suffix="%"><Input type="range" min="60" max="140" value={adjustments.brightness} onChange={(event) => applyAdjustments({ ...adjustmentRef.current, brightness: Number(event.target.value) })} onPointerUp={() => commitHistory()} onKeyUp={() => commitHistory()} /></RangeField>
                <RangeField label={pick("对比度", "Contrast")} value={adjustments.contrast} suffix="%"><Input type="range" min="60" max="140" value={adjustments.contrast} onChange={(event) => applyAdjustments({ ...adjustmentRef.current, contrast: Number(event.target.value) })} onPointerUp={() => commitHistory()} onKeyUp={() => commitHistory()} /></RangeField>
                <RangeField label={pick("饱和度", "Saturation")} value={adjustments.saturation} suffix="%"><Input type="range" min="0" max="180" value={adjustments.saturation} onChange={(event) => applyAdjustments({ ...adjustmentRef.current, saturation: Number(event.target.value) })} onPointerUp={() => commitHistory()} onKeyUp={() => commitHistory()} /></RangeField>
                <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={adjustments.grayscale} onChange={(event) => applyAdjustments({ ...adjustmentRef.current, grayscale: event.target.checked }, true)} />{pick("转换为灰度", "Convert to grayscale")}</label>
                <Button size="sm" variant="ghost" onClick={() => applyAdjustments(defaultAdjustments, true)}><Redo2 />{pick("重置调色", "Reset adjustments")}</Button>
              </div>
            </section>

            <section className="border-t border-white/10 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-zinc-600">{pick("导出设置", "Export settings")}</p>
              <div className="mt-3 space-y-3">
                <Field label={pick("格式", "Format")}><select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as EditorExportFormat)} className="h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></Field>
                {exportFormat !== "image/png" ? <RangeField label={pick("质量", "Quality")} value={quality} suffix="%"><Input type="range" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></RangeField> : null}
                {onSaveToQueue ? <Button className="w-full" variant="outline" onClick={() => void exportImage("queue")} disabled={!ready || exporting || Boolean(cropRef.current)}><Check />{pick("保存当前结果到队列", "Save current result to queue")}</Button> : null}
                <Button className="w-full" onClick={() => void exportImage()} disabled={!ready || exporting || Boolean(cropRef.current)}>{exporting ? <LoaderCircle className="animate-spin" /> : <Download />}{pick("导出到本机", "Export to device")}</Button>
                {!queueMode ? <Button className="w-full" variant="outline" onClick={() => void exportImage("optimizer")} disabled={!ready || exporting || Boolean(cropRef.current)}><ArrowRight />{pick("继续压缩与交付", "Continue to optimize")}</Button> : null}
                <Button className="w-full" variant="ghost" onClick={() => void resetAll()}>{pick("恢复到原图", "Reset all edits")}</Button>
              </div>
            </section>
          </aside>
        </div>
      </Card>

      {error ? <Alert variant="destructive"><AlertTitle>{pick("操作未完成", "Action not completed")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {exportResult ? <Alert className="border-emerald-200 bg-emerald-50/40"><Check /><AlertTitle>{exportResult.destination === "queue" ? pick("当前结果已保存", "Current result saved") : pick("图片已导出", "Image exported")}</AlertTitle><AlertDescription>{exportResult.destination === "queue" ? pick("现在可以从上方队列选择下一张图片。", "You can now select the next image from the queue above.") : pick("结果已下载到本机：", "Downloaded to this device:")} {exportResult.width} × {exportResult.height} · {formatBytes(exportResult.size)}</AlertDescription></Alert> : null}
      <Alert className="border-amber-200 bg-amber-50"><AlertTitle>{pick("导出会重新编码图片", "Export re-encodes the image")}</AlertTitle><AlertDescription>{pick("编辑和导出均在浏览器本地完成。重新编码通常会移除 EXIF、GPS、C2PA 等原始元数据，请保留仍可能需要的原文件。", "Editing and export stay in your browser. Re-encoding usually removes original EXIF, GPS, and C2PA metadata, so keep any source file you may need.")}</AlertDescription></Alert>
    </div>
  )
}

function ToolButton({ active, icon: Icon, label, onClick }: { active?: boolean; icon: typeof MousePointer2; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[.025] px-2 py-2 text-xs text-zinc-400 transition hover:border-cyan-300/35 hover:text-zinc-100", active && "border-cyan-300/50 bg-cyan-300/[.09] text-cyan-200")}><Icon className="size-4" /><span>{label}</span></button>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs text-zinc-400"><span>{label}</span>{children}</label>
}

function RangeField({ label, value, suffix, children }: { label: string; value: number; suffix: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs text-zinc-400"><span className="flex justify-between"><span>{label}</span><span className="font-mono text-zinc-500">{value}{suffix}</span></span>{children}</label>
}
