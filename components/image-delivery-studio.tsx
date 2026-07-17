"use client"

import {
  Archive,
  CheckCircle2,
  Download,
  FileImage,
  Images,
  LoaderCircle,
  OctagonX,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { useImageWorkflowMemory } from "@/components/image-workflow-memory"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { downloadBlob, formatBytes, safeError, waitForBrowserPaint } from "@/lib/browser-files"
import {
  buildBatchOutputName,
  buildBatchOutputNames,
  runSequentialBatch,
  toBatchTransformOptions,
  type BatchOutputFormat,
  type BatchTransformSettings,
} from "@/lib/image-batch"
import { validateImageFile } from "@/lib/file-validation"
import { transformImage, type TransformResult } from "@/lib/image-transformer"

type QueueStatus = "queued" | "processing" | "done" | "error"

type BatchOutput = TransformResult & {
  fileName: string
}

type QueueItem = {
  id: string
  file: File
  width: number
  height: number
  format: string
  previewUrl: string
  status: QueueStatus
  result?: BatchOutput
  error?: string
}
type StoredDeliveryQueueItem = Omit<QueueItem, "previewUrl">
type DeliveryQueueSnapshot = { items: StoredDeliveryQueueItem[]; settings: BatchTransformSettings }

export type ImageDeliveryStudioProps = {
  initialFiles?: readonly File[]
}

const emptyInitialFiles: readonly File[] = []
const maxBatchFiles = 50
const maxBatchTotalBytes = 250 * 1024 * 1024
const maxBatchImagePixels = 40_000_000
const defaultSettings: BatchTransformSettings = {
  format: "image/webp",
  quality: 82,
  maxEdge: 2400,
  nameTemplate: "{name}-ready-{index}",
}

export function ImageDeliveryStudio({ initialFiles = emptyInitialFiles }: ImageDeliveryStudioProps) {
  const { pick, format } = useLanguage()
  const workflowMemory = useImageWorkflowMemory()
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueueItem[]>([])
  const initialFilesSeenRef = useRef(new WeakSet<File>())
  const cancelRequestedRef = useRef(false)
  const addingRef = useRef(false)
  const mountedRef = useRef(true)
  const settingsRef = useRef(defaultSettings)

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [settings, setSettings] = useState(defaultSettings)
  const [adding, setAdding] = useState(false)
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [zipping, setZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)

  useEffect(() => { settingsRef.current = settings }, [settings])

  useEffect(() => {
    let cancelled = false
    mountedRef.current = true
    const params = new URLSearchParams(window.location.search)
    if (!params.has("asset") && !params.has("batch")) {
      const saved = workflowMemory.get<DeliveryQueueSnapshot>("image-compressor")
      if (saved?.items.length) {
        queueMicrotask(() => {
          if (cancelled) return
          const restored = saved.items.map<QueueItem>((item) => ({
            ...item,
            status: item.status === "processing" ? "queued" : item.status,
            previewUrl: URL.createObjectURL(item.file),
          }))
          queueRef.current = restored
          setQueue(restored)
          settingsRef.current = saved.settings
          setSettings(saved.settings)
          setProcessedCount(restored.filter((item) => item.status === "done" || item.status === "error").length)
          setNotice(pick("已恢复刚才的批量优化队列。", "Your recent batch-optimization queue was restored."))
        })
      }
    }
    return () => {
      cancelled = true
      mountedRef.current = false
      cancelRequestedRef.current = true
      addingRef.current = false
      const storedItems = queueRef.current.map<StoredDeliveryQueueItem>((item) => ({
        id: item.id,
        file: item.file,
        width: item.width,
        height: item.height,
        format: item.format,
        status: item.status === "processing" ? "queued" : item.status,
        result: item.result,
        error: item.error,
      }))
      if (storedItems.length) workflowMemory.set<DeliveryQueueSnapshot>("image-compressor", { items: storedItems, settings: settingsRef.current })
      else workflowMemory.delete("image-compressor")
      for (const item of queueRef.current) URL.revokeObjectURL(item.previewUrl)
    }
  }, [pick, workflowMemory])

  const replaceQueue = useCallback((update: (current: QueueItem[]) => QueueItem[]) => {
    setQueue((current) => {
      const next = update(current)
      queueRef.current = next
      return next
    })
  }, [])

  const updateQueueItem = useCallback((id: string, update: (item: QueueItem) => QueueItem) => {
    replaceQueue((current) => current.map((item) => item.id === id ? update(item) : item))
  }, [replaceQueue])

  const enqueueFiles = useCallback(async (candidates: readonly File[]) => {
    if (!candidates.length || running || addingRef.current) return
    addingRef.current = true
    setAdding(true)
    setError("")
    setNotice("")
    await waitForBrowserPaint()

    const current = queueRef.current
    const known = new Set(current.map((item) => fileFingerprint(item.file)))
    let totalBytes = current.reduce((sum, item) => sum + item.file.size, 0)
    const accepted: QueueItem[] = []
    const rejected: string[] = []

    for (const candidate of candidates) {
      if (current.length + accepted.length >= maxBatchFiles) {
        rejected.push(format("最多加入 {count} 张图片", "The queue accepts up to {count} images", { count: maxBatchFiles }))
        break
      }
      const fingerprint = fileFingerprint(candidate)
      if (known.has(fingerprint)) {
        rejected.push(format("{name}：已在队列中", "{name}: already in the queue", { name: candidate.name }))
        continue
      }
      if (totalBytes + candidate.size > maxBatchTotalBytes) {
        rejected.push(format("{name}：队列源文件总量不能超过 250 MB", "{name}: total source size cannot exceed 250 MB", { name: candidate.name }))
        continue
      }
      try {
        // Validation is intentionally sequential too: decoding dozens of source
        // images at once would undermine the queue's memory-safety boundary.
        const validated = await validateImageFile(candidate, maxBatchImagePixels)
        if (!mountedRef.current) break
        accepted.push({
          id: makeQueueId(),
          file: validated.file,
          width: validated.width,
          height: validated.height,
          format: validated.format,
          previewUrl: URL.createObjectURL(validated.file),
          status: "queued",
        })
        known.add(fingerprint)
        totalBytes += candidate.size
      } catch (reason) {
        rejected.push(`${candidate.name}：${safeError(reason, pick("无法读取图片", "Unable to read image"))}`)
      }
    }

    if (!mountedRef.current) {
      for (const item of accepted) URL.revokeObjectURL(item.previewUrl)
      return
    }

    if (accepted.length) {
      replaceQueue((items) => [...items, ...accepted])
      setNotice(format("已加入 {count} 张图片，等待本地处理。", "{count} images added and ready for local processing.", { count: accepted.length }))
    }
    if (rejected.length) {
      const preview = rejected.slice(0, 3).join("；")
      const remainder = rejected.length > 3 ? format("；另有 {count} 项未加入", "; {count} more were not added", { count: rejected.length - 3 }) : ""
      setError(`${preview}${remainder}`)
    }
    addingRef.current = false
    setAdding(false)
  }, [format, pick, replaceQueue, running])

  useEffect(() => {
    if (running || adding) return
    const fresh = initialFiles.filter((file) => {
      if (initialFilesSeenRef.current.has(file)) return false
      initialFilesSeenRef.current.add(file)
      return true
    })
    if (fresh.length) void enqueueFiles(fresh)
  }, [adding, enqueueFiles, initialFiles, running])

  const completed = useMemo(() => queue.filter((item) => item.result && item.status === "done"), [queue])
  const totalResultBytes = useMemo(() => completed.reduce((sum, item) => sum + (item.result?.blob.size ?? 0), 0), [completed])
  const overallProgress = queue.length ? Math.round(processedCount / queue.length * 100) : 0
  const previewName = buildBatchOutputName(queue[0]?.file.name ?? "photo.jpg", 0, settings.format, settings.nameTemplate)

  function updateSettings(next: Partial<BatchTransformSettings>) {
    setSettings((current) => ({ ...current, ...next }))
    setNotice("")
    setError("")
    setProcessedCount(0)
    replaceQueue((items) => items.map((item) => ({ ...item, status: "queued", result: undefined, error: undefined })))
  }

  async function processQueue() {
    if (!queueRef.current.length || running) return
    const snapshot = queueRef.current
    const settingSnapshot = { ...settings }
    const outputNames = buildBatchOutputNames(snapshot.map((item) => item.file.name), settingSnapshot)
    cancelRequestedRef.current = false
    setRunning(true)
    setProcessedCount(0)
    setNotice(pick("正在按队列顺序逐张处理，避免同时解码占满内存。", "Processing one image at a time to avoid decoding the whole queue into memory."))
    setError("")
    replaceQueue((items) => items.map((item) => ({ ...item, status: "queued", result: undefined, error: undefined })))

    const options = toBatchTransformOptions(settingSnapshot)
    const results = await runSequentialBatch(
      snapshot,
      async (item, index) => {
        const result = await transformImage(item.file, options)
        return { ...result, fileName: outputNames[index] } satisfies BatchOutput
      },
      {
        shouldStop: () => cancelRequestedRef.current || !mountedRef.current,
        onStart: (item) => {
          if (mountedRef.current) updateQueueItem(item.id, (current) => ({ ...current, status: "processing", error: undefined, result: undefined }))
        },
        onSettled: (result) => {
          if (!mountedRef.current) return
          if (result.status === "fulfilled") {
            updateQueueItem(result.item.id, (current) => ({ ...current, status: "done", result: result.value, error: undefined }))
          } else {
            updateQueueItem(result.item.id, (current) => ({
              ...current,
              status: "error",
              result: undefined,
              error: safeError(result.reason, pick("图片处理失败", "Image processing failed")),
            }))
          }
          setProcessedCount((count) => count + 1)
        },
      },
    )

    if (!mountedRef.current) return
    setRunning(false)
    if (cancelRequestedRef.current) {
      setNotice(format("已在当前图片完成后停止；本次处理了 {count} 张。", "Stopped after the current image; {count} images were processed in this run.", { count: results.length }))
    } else {
      const failed = results.filter((result) => result.status === "rejected").length
      setNotice(failed
        ? format("队列处理完成，{success} 张成功，{failed} 张失败。", "Queue complete: {success} succeeded and {failed} failed.", { success: results.length - failed, failed })
        : format("队列处理完成，共生成 {count} 张图片。", "Queue complete. {count} images were created.", { count: results.length }))
    }
    cancelRequestedRef.current = false
  }

  function stopAfterCurrent() {
    cancelRequestedRef.current = true
    setNotice(pick("将在当前图片处理完成后停止。", "The queue will stop after the current image finishes."))
  }

  function removeItem(id: string) {
    const removed = queueRef.current.find((item) => item.id === id)
    if (removed) URL.revokeObjectURL(removed.previewUrl)
    replaceQueue((items) => items.filter((item) => item.id !== id))
    setProcessedCount(0)
    setNotice("")
    setError("")
  }

  function clearQueue() {
    for (const item of queueRef.current) URL.revokeObjectURL(item.previewUrl)
    replaceQueue(() => [])
    workflowMemory.delete("image-compressor")
    setProcessedCount(0)
    setNotice("")
    setError("")
  }

  async function downloadZip() {
    const files = queueRef.current.filter((item): item is QueueItem & { result: BatchOutput } => Boolean(item.result && item.status === "done"))
    if (!files.length || zipping) return
    setZipping(true)
    setZipProgress(0)
    setError("")
    try {
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      for (const item of files) zip.file(item.result.fileName, item.result.blob)
      // JPG, PNG and WebP are already compressed. STORE avoids wasting CPU and
      // peak memory trying to deflate them again while still producing one ZIP.
      const archive = await zip.generateAsync(
        { type: "blob", compression: "STORE", streamFiles: true },
        ({ percent }) => {
          if (mountedRef.current) setZipProgress(Math.round(percent))
        },
      )
      if (!mountedRef.current) return
      downloadBlob(archive, `tabnative-images-${new Date().toISOString().slice(0, 10)}.zip`)
      setNotice(format("已打包 {count} 张图片。", "{count} images were packaged into a ZIP.", { count: files.length }))
    } catch (reason) {
      if (mountedRef.current) setError(safeError(reason, pick("ZIP 打包失败，请改为逐张下载。", "ZIP creation failed. Download the images individually instead.")))
    } finally {
      if (mountedRef.current) {
        setZipping(false)
        setZipProgress(0)
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Images className="size-4 text-cyan-500" />{pick("加入交付队列", "Add images to the delivery queue")}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{pick("一次选择多张 JPG、PNG 或 WebP；图片会先逐张校验，再按列表顺序处理。", "Choose multiple JPG, PNG, or WebP images. They are validated and processed one at a time in list order.")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            disabled={running || adding}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void enqueueFiles(Array.from(event.dataTransfer.files))
            }}
            className={`flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition ${dragging ? "border-cyan-500 bg-cyan-500/10" : "border-border bg-muted/25 hover:border-cyan-500/50 hover:bg-muted/45"}`}
          >
            {adding ? <LoaderCircle className="size-8 animate-spin text-cyan-500" /> : <Upload className="size-8 text-cyan-500" />}
            <span className="mt-3 text-sm font-semibold text-foreground">{adding ? pick("正在逐张检查图片", "Checking images one at a time") : pick("拖入多张图片，或点击选择", "Drop multiple images, or click to choose")}</span>
            <span className="mt-1 text-xs text-muted-foreground">JPG · PNG · WEBP · {pick("最多 50 张 / 源文件合计 250 MB", "Up to 50 images / 250 MB total source size")}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => {
              void enqueueFiles(Array.from(event.target.files ?? []))
              event.currentTarget.value = ""
            }}
          />
          {adding ? <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[.08] px-4 py-3 text-sm text-foreground"><LoaderCircle className="size-5 shrink-0 animate-spin text-cyan-500" /><span><strong>{pick("图片正在加入优化队列", "Adding images to the optimization queue")}</strong><span className="ml-2 text-muted-foreground">{pick("正在逐张读取并校验，请稍候；完成后会自动显示原图预览。", "Reading and validating images one at a time. Original previews will appear automatically when ready.")}</span></span></div> : null}
          {queue.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-muted/15">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <p className="text-sm font-semibold text-foreground">{pick("原图预览", "Original previews")}</p>
                <p className="text-xs text-muted-foreground">{format("已加入 {count} 张", "{count} images added", { count: queue.length })}</p>
              </div>
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-5 lg:grid-cols-7">
                {queue.map((item) => (
                  <div key={item.id} className="min-w-0">
                    <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-background/50">
                      {/* Blob URLs are local queue previews and cannot be optimized by next/image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.previewUrl} alt={format("{name} 的原图预览", "Original preview of {name}", { name: item.file.name })} className="size-full object-contain" />
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground" title={item.file.name}>{item.file.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{pick("统一交付设置", "Delivery settings")}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{pick("设置修改后，已有结果会回到等待状态，确保最终 ZIP 使用同一套参数。", "Changing a setting returns existing results to queued state so the final ZIP uses one consistent configuration.")}</p>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={pick("输出格式", "Output format")}>
            <select disabled={running} value={settings.format} onChange={(event) => updateSettings({ format: event.target.value as BatchOutputFormat })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
              <option value="image/png">PNG</option>
            </select>
          </Field>
          <Field label={`${pick("质量", "Quality")} ${settings.quality}%`}>
            <Input disabled={running || settings.format === "image/png"} type="range" min="20" max="100" value={settings.quality} onChange={(event) => updateSettings({ quality: Number(event.target.value) })} className="px-0" />
          </Field>
          <Field label={pick("最大边（像素）", "Longest edge (pixels)")}>
            <Input disabled={running} type="number" min="320" max="12000" value={settings.maxEdge ?? ""} placeholder={pick("留空保持原尺寸", "Blank keeps source size")} onChange={(event) => updateSettings({ maxEdge: event.target.value ? Number(event.target.value) : undefined })} />
          </Field>
          <Field label={pick("目标大小（KB，可选）", "Target size in KB (optional)")}>
            <Input disabled={running || settings.format === "image/png"} type="number" min="10" max="10000" value={settings.targetKb ?? ""} placeholder={pick("留空则不限制", "Blank for no target")} onChange={(event) => updateSettings({ targetKb: event.target.value ? Number(event.target.value) : undefined })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label={pick("文件命名规则", "File naming rule")}>
              <Input disabled={running} value={settings.nameTemplate} onChange={(event) => updateSettings({ nameTemplate: event.target.value })} placeholder="{name}-ready-{index}" />
            </Field>
            <p className="mt-2 text-xs text-muted-foreground">{pick("可用变量：{name} 原文件名、{index} 两位序号、{ext} 扩展名。", "Variables: {name} source name, {index} two-digit position, and {ext} extension.")}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">{pick("文件名预览", "Filename preview")}</p>
            <p className="mt-1 break-all font-mono text-xs text-foreground">{previewName}</p>
          </div>
          {settings.format === "image/png" ? <Alert className="sm:col-span-2 lg:col-span-4"><AlertTitle>{pick("PNG 使用无损编码", "PNG uses lossless encoding")}</AlertTitle><AlertDescription>{pick("质量和目标 KB 不适用于 PNG；可通过最大边控制尺寸。", "Quality and target KB do not apply to PNG. Use the longest-edge setting to control its size.")}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <ShieldCheck className="text-amber-500" />
        <AlertTitle>{pick("默认清理原始元数据", "Original metadata is removed by default")}</AlertTitle>
        <AlertDescription>{pick("交付结果由浏览器重新编码，不会带回原图中的 EXIF、GPS、XMP、IPTC 或 C2PA 等元数据与来源凭证。源文件不会被修改，请自行保留原件。", "Delivery outputs are re-encoded in your browser and do not carry over EXIF, GPS, XMP, IPTC, C2PA, or other source metadata. Source files are never changed, so keep the originals you need.")}</AlertDescription>
      </Alert>

      <Card className="border-border bg-card shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FileImage className="size-4 text-cyan-500" />{pick("图片队列", "Image queue")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{queue.length ? format("{count} 张 · {size} · 已显示原图预览", "{count} images · {size} · original previews shown", { count: queue.length, size: formatBytes(queue.reduce((sum, item) => sum + item.file.size, 0)) }) : pick("尚未加入图片", "No images added yet")}</p>
          </div>
          {queue.length ? <Button variant="ghost" size="sm" disabled={running || zipping} onClick={clearQueue}><Trash2 />{pick("清空", "Clear")}</Button> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {queue.length ? (
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {queue.map((item, index) => (
                <li key={item.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
                      {/* Blob URLs are local queue previews and cannot be optimized by next/image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.previewUrl} alt={format("{name} 的原图预览", "Original preview of {name}", { name: item.file.name })} loading="lazy" decoding="async" className="size-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.format} · {item.width} × {item.height} · {formatBytes(item.file.size)}</p>
                      {item.result ? <p className="mt-1 break-all text-xs text-emerald-600 dark:text-emerald-400">{item.result.fileName} · {item.result.width} × {item.result.height} · {formatBytes(item.result.blob.size)}{settings.targetKb && !item.result.targetReached ? pick(" · 未完全达到目标 KB", " · target KB not fully reached") : ""}</p> : null}
                      {item.error ? <p className="mt-1 text-xs text-destructive">{item.error}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <StatusBadge status={item.status} />
                    {item.result ? <Button size="sm" variant="outline" onClick={() => downloadBlob(item.result!.blob, item.result!.fileName)}><Download />{pick("下载", "Download")}</Button> : null}
                    <Button size="icon-sm" variant="ghost" disabled={running || zipping} onClick={() => removeItem(item.id)} aria-label={format("移除 {name}", "Remove {name}", { name: item.file.name })}><Trash2 /></Button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">{pick("加入图片后，这里会显示处理顺序与逐项结果。", "Add images to see processing order and individual results here.")}</div>
          )}

          {running ? <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>{pick("串行处理中", "Processing sequentially")}</span><span>{processedCount} / {queue.length}</span></div><Progress value={overallProgress} /></div> : null}
          {zipping ? <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>{pick("正在生成 ZIP", "Creating ZIP")}</span><span>{zipProgress}%</span></div><Progress value={zipProgress} /></div> : null}
          {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
          {error ? <Alert variant="destructive"><OctagonX /><AlertTitle>{pick("部分文件未处理", "Some files were not processed")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button size="lg" disabled={!queue.length || running || adding || zipping} onClick={() => void processQueue()}><Play />{pick("开始顺序处理", "Start sequential processing")}</Button>
            {running ? <Button size="lg" variant="outline" onClick={stopAfterCurrent}><Square />{pick("处理完当前项后停止", "Stop after current")}</Button> : null}
            <Button size="lg" variant="outline" disabled={!completed.length || running || zipping} onClick={() => void downloadZip()}>{zipping ? <LoaderCircle className="animate-spin" /> : <Archive />}{format("下载 ZIP（{count} 张）", "Download ZIP ({count})", { count: completed.length })}</Button>
            {completed.length ? <span className="self-center text-xs text-muted-foreground">{pick("结果合计", "Output total")} {formatBytes(totalResultBytes)}</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium text-foreground"><span>{label}</span>{children}</label>
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const { pick } = useLanguage()
  if (status === "processing") return <Badge variant="outline"><LoaderCircle className="animate-spin" />{pick("处理中", "Processing")}</Badge>
  if (status === "done") return <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"><CheckCircle2 />{pick("已完成", "Done")}</Badge>
  if (status === "error") return <Badge variant="outline" className="border-destructive/30 text-destructive"><OctagonX />{pick("失败", "Failed")}</Badge>
  return <Badge variant="outline"><RotateCcw />{pick("等待", "Queued")}</Badge>
}

function fileFingerprint(file: File) {
  return `${file.name.toLocaleLowerCase()}:${file.size}:${file.lastModified}`
}

function makeQueueId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
