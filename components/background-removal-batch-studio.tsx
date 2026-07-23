"use client"

import { Archive, ArrowRight, Download, Images, LoaderCircle, MousePointerClick, OctagonX, Pencil, Play, Square, Trash2, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { BackgroundFinishEditor } from "@/components/background-finish-editor"
import { BackgroundMaskEditor } from "@/components/background-mask-editor"
import { useImageWorkflowMemory } from "@/components/image-workflow-memory"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  backgroundFinishOutputName,
  composeBackgroundFinish,
  type BackgroundFinishOutput,
  type BackgroundFinishSettings,
} from "@/lib/background-finish"
import { downloadBlob, waitForBrowserPaint } from "@/lib/browser-files"
import { validateImageFile } from "@/lib/file-validation"
import { backgroundRemovalOutputName, canRefineBackground } from "@/lib/background-removal"
import { IMAGE_EDITOR_MAX_PIXELS } from "@/lib/image-editor"
import { IMAGE_PIPELINE_BATCH_MAX_ITEMS, saveLocalAssetBatch } from "@/lib/local-asset-transfer"

type QueueStatus = "queued" | "processing" | "done" | "error"
type FinishedResult = BackgroundFinishOutput & { url: string }
type RemovalResult = { blob: Blob; url: string; width: number; height: number; backend: string; finish?: FinishedResult }
type QueueItem = { id: string; file: File; previewUrl: string; width: number; height: number; status: QueueStatus; result?: RemovalResult; error?: string }
type StoredRemovalResult = Omit<RemovalResult, "url" | "finish"> & { finish?: Omit<FinishedResult, "url"> }
type StoredQueueItem = Omit<QueueItem, "previewUrl" | "result"> & { result?: StoredRemovalResult }
type BackgroundQueueSnapshot = { items: StoredQueueItem[] }
type WorkerMessage = { type: "progress" | "status" | "result" | "error"; stage?: string; progress?: number; buffer?: ArrayBuffer; width?: number; height?: number; backend?: string; code?: string }

const MAX_TOTAL_BYTES = 150 * 1024 * 1024
const MAX_FILE_BYTES = 15 * 1024 * 1024

function deliveryResult(result: RemovalResult) {
  return result.finish ?? result
}

function deliveryName(fileName: string, result: RemovalResult) {
  return result.finish
    ? backgroundFinishOutputName(fileName, result.finish.settings.outputType)
    : backgroundRemovalOutputName(fileName)
}

export function BackgroundRemovalBatchStudio() {
  const { pick, format } = useLanguage()
  const router = useRouter()
  const workflowMemory = useImageWorkflowMemory()
  const inputRef = useRef<HTMLInputElement>(null)
  const refinementRef = useRef<HTMLElement>(null)
  const pickRef = useRef(pick)
  const workerRef = useRef<Worker | null>(null)
  const queueRef = useRef<QueueItem[]>([])
  const stopRef = useRef(false)
  const mountedRef = useRef(true)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [adding, setAdding] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [itemProgress, setItemProgress] = useState(0)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [zipping, setZipping] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [handingOff, setHandingOff] = useState(false)

  useEffect(() => {
    pickRef.current = pick
  }, [pick])

  useEffect(() => {
    let cancelled = false
    mountedRef.current = true
    const saved = workflowMemory.get<BackgroundQueueSnapshot>("remove-background")
    if (saved?.items.length) {
      queueMicrotask(() => {
        if (cancelled) return
        const restored = saved.items.map<QueueItem>((item) => ({
          ...item,
          status: item.status === "processing" ? "queued" : item.status,
          previewUrl: URL.createObjectURL(item.file),
          result: item.result ? {
            ...item.result,
            url: URL.createObjectURL(item.result.blob),
            finish: item.result.finish ? { ...item.result.finish, url: URL.createObjectURL(item.result.finish.blob) } : undefined,
          } : undefined,
        }))
        queueRef.current = restored
        setQueue(restored)
        setProcessed(restored.filter((item) => item.status === "done" || item.status === "error").length)
          setNotice(pickRef.current("已恢复刚才的去背景队列。", "Your recent background-removal queue was restored."))
      })
    }
    return () => {
      cancelled = true
      mountedRef.current = false
      stopRef.current = true
      workerRef.current?.terminate()
      const storedItems = queueRef.current.map<StoredQueueItem>((item) => ({
        id: item.id,
        file: item.file,
        width: item.width,
        height: item.height,
        status: item.status === "processing" ? "queued" : item.status,
        error: item.error,
        result: item.result ? {
          blob: item.result.blob,
          width: item.result.width,
          height: item.result.height,
          backend: item.result.backend,
          finish: item.result.finish ? {
            blob: item.result.finish.blob,
            width: item.result.finish.width,
            height: item.result.finish.height,
            settings: item.result.finish.settings,
          } : undefined,
        } : undefined,
      }))
      if (storedItems.length) workflowMemory.set<BackgroundQueueSnapshot>("remove-background", { items: storedItems })
      else workflowMemory.delete("remove-background")
      for (const item of queueRef.current) {
        URL.revokeObjectURL(item.previewUrl)
        if (item.result) {
          URL.revokeObjectURL(item.result.url)
          if (item.result.finish) URL.revokeObjectURL(item.result.finish.url)
        }
      }
    }
  }, [workflowMemory])

  const replaceQueue = useCallback((update: (current: QueueItem[]) => QueueItem[]) => {
    setQueue((current) => {
      const next = update(current)
      queueRef.current = next
      return next
    })
  }, [])

  const updateItem = useCallback((id: string, update: (item: QueueItem) => QueueItem) => {
    replaceQueue((items) => items.map((item) => item.id === id ? update(item) : item))
  }, [replaceQueue])

  async function addFiles(files: readonly File[]) {
    if (!files.length || running || adding) return
    flushSync(() => {
      setAdding(true)
      setError("")
    })
    await waitForBrowserPaint()
    const current = queueRef.current
    const known = new Set(current.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`))
    let totalBytes = current.reduce((sum, item) => sum + item.file.size, 0)
    const accepted: QueueItem[] = []
    const rejected: string[] = []
    for (const candidate of files) {
      if (current.length + accepted.length >= IMAGE_PIPELINE_BATCH_MAX_ITEMS) { rejected.push(format("最多加入 {count} 张图片", "The queue accepts up to {count} images", { count: IMAGE_PIPELINE_BATCH_MAX_ITEMS })); break }
      if (candidate.size > MAX_FILE_BYTES) { rejected.push(`${candidate.name}：${pick("超过 15 MB", "larger than 15 MB")}`); continue }
      if (totalBytes + candidate.size > MAX_TOTAL_BYTES) { rejected.push(pick("源图片合计不能超过 150 MB", "Source images cannot exceed 150 MB in total")); break }
      const fingerprint = `${candidate.name}:${candidate.size}:${candidate.lastModified}`
      if (known.has(fingerprint)) continue
      try {
        const validated = await validateImageFile(candidate, IMAGE_EDITOR_MAX_PIXELS)
        const item: QueueItem = {
          id: crypto.randomUUID(), file: validated.file, previewUrl: URL.createObjectURL(validated.file),
          width: validated.width, height: validated.height, status: "queued",
        }
        accepted.push(item)
        known.add(fingerprint)
        totalBytes += candidate.size
      } catch (reason) {
        rejected.push(`${candidate.name}：${reason instanceof Error ? reason.message : pick("无法读取", "unable to read")}`)
      }
    }
    if (!mountedRef.current) {
      for (const item of accepted) URL.revokeObjectURL(item.previewUrl)
      return
    }
    if (accepted.length) replaceQueue((items) => [...items, ...accepted])
    setNotice(accepted.length ? format("已加入 {count} 张图片。", "{count} images added.", { count: accepted.length }) : "")
    setError(rejected.slice(0, 3).join("；"))
    setAdding(false)
  }

  async function loadSample() {
    if (running || adding || loadingSample) return
    setLoadingSample(true)
    setError("")
    try {
      const sample = new Image()
      sample.decoding = "async"
      await new Promise<void>((resolve, reject) => {
        sample.onload = () => resolve()
        sample.onerror = () => reject(new Error("sample-load-failed"))
        sample.src = "/samples/remove-background-cat.png"
      })
      const canvas = document.createElement("canvas")
      canvas.width = sample.naturalWidth
      canvas.height = sample.naturalHeight
      const context = canvas.getContext("2d")
      if (!context) throw new Error("sample-canvas-unavailable")
      context.drawImage(sample, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("sample-encode-failed")), "image/png")
      })
      await addFiles([new File([blob], "tabnative-remove-background-sample.png", {
        type: "image/png",
        lastModified: 0,
      })])
    } catch {
      setError(pick("无法载入示例。", "Unable to load the sample."))
    } finally {
      if (mountedRef.current) setLoadingSample(false)
    }
  }

  async function processOne(item: QueueItem) {
    const worker = new Worker(new URL("../workers/background-removal.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    try {
      const buffer = await item.file.arrayBuffer()
      const nav = navigator as Navigator & { gpu?: unknown }
      return await new Promise<RemovalResult>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const message = event.data
          if (message.type === "progress") setItemProgress(Math.max(2, Math.min(95, Number(message.progress) || 2)))
          if (message.type === "status" && message.stage === "removing-background") setItemProgress((value) => Math.max(value, 96))
          if (message.type === "error") reject(new Error(message.code || "processing-failed"))
          if (message.type === "result" && message.buffer) {
            const blob = new Blob([message.buffer], { type: "image/png" })
            resolve({ blob, url: URL.createObjectURL(blob), width: message.width || 0, height: message.height || 0, backend: message.backend || "wasm" })
          }
        }
        worker.onerror = () => reject(new Error("worker-failed"))
        worker.postMessage({ type: "process", buffer, mime: item.file.type, preferWebGpu: Boolean(nav.gpu) }, [buffer])
      })
    } finally {
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }
  }

  async function processQueue() {
    if (!queueRef.current.length || running) return
    stopRef.current = false
    setRunning(true)
    setProcessed(0)
    setItemProgress(0)
    setError("")
    setNotice(pick("正在按队列顺序逐张移除背景。", "Removing backgrounds one image at a time in queue order."))
    const snapshot = [...queueRef.current]
    for (const item of snapshot) {
      if (stopRef.current || !mountedRef.current) break
      updateItem(item.id, (current) => {
        if (current.result) {
          URL.revokeObjectURL(current.result.url)
          if (current.result.finish) URL.revokeObjectURL(current.result.finish.url)
        }
        return { ...current, status: "processing", result: undefined, error: undefined }
      })
      setItemProgress(1)
      try {
        const result = await processOne(item)
        if (!mountedRef.current) { URL.revokeObjectURL(result.url); break }
        updateItem(item.id, (current) => ({ ...current, status: "done", result, error: undefined }))
      } catch (reason) {
        if (!mountedRef.current || stopRef.current) break
        const code = reason instanceof Error ? reason.message : "processing-failed"
        const message = code === "general-model-load-failed"
          ? pick("本地处理能力准备失败，请检查网络后重试。", "On-device processing could not be prepared. Check your connection and retry.")
          : pick("未能移除背景，请稍后重试。", "Background removal failed. Try again later.")
        updateItem(item.id, (current) => ({ ...current, status: "error", error: message }))
      }
      if (mountedRef.current) setProcessed((value) => value + 1)
    }
    if (mountedRef.current) {
      setRunning(false)
      setItemProgress(0)
      setNotice(stopRef.current ? pick("已在当前图片结束后停止。", "Stopped after the current image.") : pick("批量去背景处理完成。", "Batch background removal is complete."))
    }
  }

  function removeItem(id: string) {
    const item = queueRef.current.find((candidate) => candidate.id === id)
    if (item) {
      URL.revokeObjectURL(item.previewUrl)
      if (item.result) {
        URL.revokeObjectURL(item.result.url)
        if (item.result.finish) URL.revokeObjectURL(item.result.finish.url)
      }
    }
    replaceQueue((items) => items.filter((candidate) => candidate.id !== id))
    if (selectedId === id) setSelectedId("")
  }

  function clearQueue() {
    for (const item of queueRef.current) {
      URL.revokeObjectURL(item.previewUrl)
      if (item.result) {
        URL.revokeObjectURL(item.result.url)
        if (item.result.finish) URL.revokeObjectURL(item.result.finish.url)
      }
    }
    replaceQueue(() => [])
    workflowMemory.delete("remove-background")
    setProcessed(0); setNotice(""); setError(""); setSelectedId("")
  }

  const completed = useMemo(() => queue.filter((item): item is QueueItem & { result: RemovalResult } => Boolean(item.result && item.status === "done")), [queue])
  const selectedItem = useMemo(() => completed.find((item) => item.id === selectedId) ?? null, [completed, selectedId])

  useEffect(() => {
    if (!selectedId) return
    const frame = requestAnimationFrame(() => refinementRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    return () => cancelAnimationFrame(frame)
  }, [selectedId])

  async function applyRefinement(id: string, blob: Blob) {
    const item = queueRef.current.find((candidate) => candidate.id === id)
    if (!item?.result) return
    const url = URL.createObjectURL(blob)
    let finish: FinishedResult | undefined
    if (item.result.finish) {
      try {
        const output = await composeBackgroundFinish(item.file, blob, item.result.finish.settings)
        finish = { ...output, url: URL.createObjectURL(output.blob) }
      } catch {
        setNotice(pick("边缘修正已保存；原有成品设置需要重新应用。", "Edge refinements were saved. Reapply the previous finished-image settings."))
      }
    }
    updateItem(id, (current) => {
      if (!current.result) {
        URL.revokeObjectURL(url)
        if (finish) URL.revokeObjectURL(finish.url)
        return current
      }
      URL.revokeObjectURL(current.result.url)
      if (current.result.finish) URL.revokeObjectURL(current.result.finish.url)
      return { ...current, result: { ...current.result, blob, url, finish } }
    })
    if (!item.result.finish || finish) setNotice(pick("边缘修正已保存，成品预览与下载已同步更新。", "Edge refinements were saved and the finished preview and downloads were updated."))
  }

  function applyFinishedResult(id: string, output: BackgroundFinishOutput) {
    const finish: FinishedResult = { ...output, url: URL.createObjectURL(output.blob) }
    updateItem(id, (current) => {
      if (!current.result) {
        URL.revokeObjectURL(finish.url)
        return current
      }
      if (current.result.finish) URL.revokeObjectURL(current.result.finish.url)
      return { ...current, result: { ...current.result, finish } }
    })
    setNotice(pick("成品设置已应用到当前图片，下载与后续修图将优先使用这个版本。", "Finished-image settings were applied. Downloads and the next editing step will use this version."))
  }

  async function applyFinishedResultToBatch(settings: BackgroundFinishSettings) {
    const snapshot = queueRef.current.filter((item): item is QueueItem & { result: RemovalResult } => Boolean(item.result && item.status === "done"))
    let applied = 0
    for (const item of snapshot) {
      const output = await composeBackgroundFinish(item.file, item.result.blob, settings)
      if (!mountedRef.current) return
      const finish: FinishedResult = { ...output, url: URL.createObjectURL(output.blob) }
      updateItem(item.id, (current) => {
        if (!current.result) {
          URL.revokeObjectURL(finish.url)
          return current
        }
        if (current.result.finish) URL.revokeObjectURL(current.result.finish.url)
        return { ...current, result: { ...current.result, finish } }
      })
      applied += 1
      setNotice(format("正在应用成品设置：{done}/{count}", "Applying finished-image settings: {done}/{count}", { done: applied, count: snapshot.length }))
      await waitForBrowserPaint()
    }
    setNotice(format("成品设置已应用到 {count} 张图片。", "Finished-image settings were applied to {count} images.", { count: applied }))
  }

  async function downloadZip() {
    if (!completed.length || zipping) return
    setZipping(true); setError("")
    try {
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      for (const item of completed) {
        const output = deliveryResult(item.result)
        zip.file(deliveryName(item.file.name, item.result), output.blob)
      }
      downloadBlob(await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }), `tabnative-remove-background-${new Date().toISOString().slice(0, 10)}.zip`)
    } catch { setError(pick("ZIP 打包失败，请逐张下载。", "ZIP creation failed. Download images individually.")) }
    finally { setZipping(false) }
  }

  async function continueToBatchEditor() {
    if (!completed.length || handingOff || running) return
    setHandingOff(true)
    setError("")
    try {
      const batchId = await saveLocalAssetBatch(completed.map((item) => ({
        blob: deliveryResult(item.result).blob,
        name: deliveryName(item.file.name, item.result),
      })), "background-remover")
      router.push(`/image-editor?batch=${encodeURIComponent(batchId)}`)
    } catch {
      setError(pick("无法把当前队列交给批量快速修图。请减少图片数量或文件总大小后重试。", "The queue could not be passed to batch quick editing. Reduce the number or total size of the images and try again."))
      setHandingOff(false)
    }
  }

  return <div className="space-y-6">
    <Card className="border-cyan-300/20 bg-cyan-300/[.035] shadow-none">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Images className="size-4 text-cyan-300" />{pick("批量移除背景", "Batch background removal")}</CardTitle><p className="text-sm text-zinc-500">{pick("一次加入多张图片，按顺序处理，避免同时占用过多显存和内存。", "Add multiple images and process them sequentially to limit GPU and memory use.")}</p></CardHeader>
      <CardContent className="space-y-4">
        <button type="button" aria-busy={adding || loadingSample} disabled={running || adding || loadingSample} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(Array.from(event.dataTransfer.files)) }} className={`flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition ${adding || loadingSample ? "border-cyan-300/60 bg-cyan-300/[.08]" : dragging ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 bg-white/[.025] hover:border-cyan-300/45"}`}>
          {adding || loadingSample ? <LoaderCircle className="size-8 animate-spin text-cyan-300" /> : <Upload className="size-8 text-cyan-300" />}<span className="mt-3 text-sm font-semibold text-zinc-100">{loadingSample ? pick("正在载入示例", "Loading sample") : adding ? pick("正在检查图片", "Checking images") : pick("拖入多张图片，或点击选择", "Drop multiple images, or click to choose")}</span><span className="mt-1 text-xs text-zinc-500">JPG · PNG · WEBP · {format("最多 {count} 张", "Up to {count} images", { count: IMAGE_PIPELINE_BATCH_MAX_ITEMS })}</span>
        </button>
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = "" }} />
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3 sm:flex-row sm:items-center">
          <div className="h-20 w-full shrink-0 overflow-hidden rounded-lg bg-[#0a0a0a] sm:w-20">
            {/* Static sample asset; no optimization is needed for this small local preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/samples/remove-background-cat.png" alt="" aria-hidden="true" className="size-full object-cover" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-6 text-zinc-500">{pick("从设备选择图片，或使用页面示例快速了解完整流程。", "Choose an image from your device, or load the sample to explore the complete workflow.")}</p>
          <Button type="button" variant="outline" className="shrink-0" disabled={running || adding || loadingSample} onClick={() => void loadSample()}>
            {loadingSample ? <LoaderCircle className="animate-spin" /> : <Play />}
            {pick("试用示例", "Try sample")}
          </Button>
        </div>
        {adding ? <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-cyan-300/30 bg-cyan-300/[.08] px-4 py-3 text-sm text-zinc-200"><LoaderCircle className="size-5 shrink-0 animate-spin text-cyan-300" /><span><strong>{pick("图片正在加入队列", "Adding images to the queue")}</strong><span className="ml-2 text-zinc-500">{pick("正在逐张读取并校验，请稍候；完成后会自动显示预览。", "Reading and validating images one at a time. Previews will appear automatically when ready.")}</span></span></div> : null}
      </CardContent>
    </Card>

    {queue.length ? <Card className="border-white/10 bg-[#111] shadow-none"><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle className="text-base">{pick("处理队列", "Processing queue")}</CardTitle><p className="mt-1 text-xs text-zinc-500">{format("{count} 张图片，{done} 张已完成", "{count} images, {done} complete", { count: queue.length, done: completed.length })}</p></div><Button size="sm" variant="ghost" disabled={running} onClick={clearQueue}><Trash2 />{pick("清空", "Clear")}</Button></CardHeader><CardContent className="space-y-4">
      {completed.length && !selectedItem ? <div role="status" className="flex flex-col gap-4 rounded-xl border border-cyan-300/35 bg-cyan-300/[.08] p-4 shadow-[0_0_28px_rgba(34,211,238,.06)] sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-cyan-950"><MousePointerClick className="size-5" /></span><div><p className="font-semibold text-zinc-100">{pick("去背后可继续修边并制作成品", "Refine the cutout and finish the image")}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">{pick("点击任意结果，可补回主体或擦除残留背景，也可换成纯色、渐变、自定义图片或模糊背景，并调整画布、主体位置和阴影。", "Select any result to restore or erase mask areas, replace the background with a color, gradient, custom image, or blur, and adjust the canvas, subject position, and shadow.")}</p></div></div><Button className="shrink-0" onClick={() => setSelectedId(completed[0].id)}><Pencil />{pick("编辑第一张结果", "Edit the first result")}</Button></div> : null}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{queue.map((item) => {
        const output = item.result ? deliveryResult(item.result) : null
        return <li key={item.id} className={`overflow-hidden rounded-xl border bg-white/[.02] transition ${item.id === selectedId ? "border-cyan-300/70 ring-1 ring-cyan-300/20" : "border-white/10"}`}>
          <div className="grid grid-cols-2 gap-px bg-white/10">
            <Preview url={item.previewUrl} alt={format("{name} 原图", "Original {name}", { name: item.file.name })} label={pick("原图", "Original")} />
            {item.result && output ? <button type="button" onClick={() => setSelectedId(item.id)} className="group relative text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset" aria-label={format("编辑 {name} 的去背结果", "Edit the background-removed result for {name}", { name: item.file.name })}><Preview url={output.url} alt={format("{name} 处理结果", "Processed result for {name}", { name: item.file.name })} label={item.result.finish ? pick("成品 · 点击继续编辑", "Finished · Select to edit") : pick("透明结果 · 点击继续编辑", "Transparent · Select to edit")} checker={!item.result.finish} action /><span className="workflow-preview-pencil pointer-events-none absolute right-2 top-2 grid size-8 place-items-center rounded-full opacity-90 shadow-sm transition group-hover:scale-105 group-hover:opacity-100"><Pencil className="size-4" /></span></button> : <div className="grid aspect-square place-items-center bg-[#0a0a0a] text-xs text-zinc-600">{item.status === "processing" ? <LoaderCircle className="animate-spin text-cyan-300" /> : pick("等待结果", "Awaiting result")}</div>}
          </div>
          <div className="space-y-2 p-3"><p className="truncate text-sm font-medium text-zinc-200">{item.file.name}</p><div className="flex items-center justify-between gap-2"><Status status={item.status} /><span className="text-[10px] text-zinc-600">{output ? `${output.width} × ${output.height}` : `${item.width} × ${item.height}`}</span></div>{item.error ? <p className="text-xs text-red-400">{item.error}</p> : null}<div className="flex flex-wrap gap-2">{item.result && output ? <><Button size="sm" onClick={() => setSelectedId(item.id)}><Pencil />{pick("继续编辑", "Continue editing")}</Button><Button size="sm" variant="outline" onClick={() => downloadBlob(output.blob, deliveryName(item.file.name, item.result!))}><Download />{pick("下载", "Download")}</Button></> : null}<Button size="icon-sm" variant="ghost" disabled={running} onClick={() => removeItem(item.id)} aria-label={pick("移除", "Remove")}><Trash2 /></Button></div></div>
        </li>
      })}</ol>
      {running ? <div className="space-y-2"><div className="flex justify-between text-xs text-zinc-500"><span>{processed + 1} / {queue.length}</span><span>{itemProgress}%</span></div><Progress value={itemProgress} /></div> : null}
      {notice ? <p role="status" className="text-sm text-zinc-500">{notice}</p> : null}{error ? <Alert variant="destructive"><OctagonX /><AlertTitle>{pick("部分操作未完成", "Some actions did not finish")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4"><Button size="lg" disabled={running || zipping || handingOff} onClick={() => void processQueue()}><Play />{pick("开始批量去背景", "Start batch removal")}</Button>{running ? <Button size="lg" variant="outline" onClick={() => { stopRef.current = true }}><Square />{pick("处理完当前项后停止", "Stop after current")}</Button> : null}<Button size="lg" variant="outline" disabled={!completed.length || running || zipping || handingOff} onClick={() => void downloadZip()}>{zipping ? <LoaderCircle className="animate-spin" /> : <Archive />}{format("下载 ZIP（{count} 张）", "Download ZIP ({count})", { count: completed.length })}</Button><Button size="lg" disabled={!completed.length || running || zipping || handingOff} onClick={() => void continueToBatchEditor()}>{handingOff ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{handingOff ? pick("处理中", "Processing") : format("继续批量快速修图（{count} 张）", "Continue to batch quick editing ({count})", { count: completed.length })}</Button></div>
    </CardContent></Card> : null}

    {selectedItem ? <section ref={refinementRef} className="scroll-mt-24 space-y-3" aria-label={pick("当前去背结果编辑", "Edit selected background-removed result")}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.035] p-4"><div><p className="flex items-center gap-2 font-semibold text-zinc-100"><Pencil className="size-4 text-cyan-300" />{pick("编辑当前去背结果", "Edit selected result")}</p><p className="mt-1 text-sm text-zinc-500">{selectedItem.file.name} · {pick("修边与成品设置都会同步到队列预览、单张下载、ZIP 和下一步修图。", "Mask refinements and finished-image settings update the queue preview, downloads, ZIP, and the next editing step.")}</p></div><Button size="icon-sm" variant="ghost" onClick={() => setSelectedId("")} aria-label={pick("关闭结果编辑", "Close result editing")}><X /></Button></div>
       <Tabs key={selectedItem.id} defaultValue="finish" className="flex-col gap-3">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 border border-white/10 bg-white/[.025]">
          <TabsTrigger value="finish" className="min-h-10">{pick("成品编辑", "Finish image")}</TabsTrigger>
          <TabsTrigger value="refine" className="min-h-10">{pick("边缘修正", "Refine edges")}</TabsTrigger>
        </TabsList>
        <TabsContent value="finish">
          <BackgroundFinishEditor
            source={selectedItem.file}
            cutout={selectedItem.result.blob}
            initialSettings={selectedItem.result.finish?.settings}
            batchCount={completed.length}
            onApply={(output) => applyFinishedResult(selectedItem.id, output)}
            onApplyBatch={applyFinishedResultToBatch}
          />
        </TabsContent>
        <TabsContent value="refine">
          {canRefineBackground(selectedItem.result.width, selectedItem.result.height)
            ? <BackgroundMaskEditor key={selectedItem.result.url} source={selectedItem.file} result={selectedItem.result.blob} onApply={(blob) => applyRefinement(selectedItem.id, blob)} />
            : <Alert><OctagonX /><AlertTitle>{pick("图片尺寸过大", "Image is too large")}</AlertTitle><AlertDescription>{pick("透明结果仍可下载，但当前标签页无法同时为这张大图加载边缘修正画布。请先缩小图片尺寸。", "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.")}</AlertDescription></Alert>}
        </TabsContent>
      </Tabs>
    </section> : null}
  </div>
}

function Preview({ url, alt, label, checker = false, action = false }: { url: string; alt: string; label: string; checker?: boolean; action?: boolean }) {
  return <div className={`relative grid aspect-square place-items-center overflow-hidden bg-[#0a0a0a] ${checker ? "bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:16px_16px]" : ""}`}>
    {/* Blob URLs are local previews and cannot be optimized by next/image. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={alt} className="size-full object-contain" /><span className={action ? "workflow-preview-action absolute inset-x-2 bottom-2 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold shadow-sm" : "workflow-preview-label absolute bottom-1.5 left-1.5 rounded px-2 py-1 text-[10px] font-semibold shadow-sm"}>{label}</span>
  </div>
}

function Status({ status }: { status: QueueStatus }) {
  const { pick } = useLanguage()
  if (status === "processing") return <Badge variant="outline"><LoaderCircle className="animate-spin" />{pick("处理中", "Processing")}</Badge>
  if (status === "done") return <Badge variant="outline" className="border-emerald-300/30 text-emerald-300">{pick("已完成", "Done")}</Badge>
  if (status === "error") return <Badge variant="outline" className="border-red-300/30 text-red-300">{pick("失败", "Failed")}</Badge>
  return <Badge variant="outline">{pick("等待", "Queued")}</Badge>
}
