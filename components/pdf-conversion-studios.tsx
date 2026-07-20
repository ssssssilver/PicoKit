"use client"

/* eslint-disable @next/next/no-img-element -- previews are local object URLs. */

import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  FileImage,
  FilePlus2,
  GripVertical,
  Images,
  LoaderCircle,
  Maximize2,
  Package,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { baseName, canvasToBlob, downloadBlob, formatBytes, waitForBrowserPaint } from "@/lib/browser-files"
import {
  buildPdfPageSelection,
  formatPdfPageSelection,
  layoutPdfImage,
  PDF_IMAGE_MAX_FILES,
  PDF_IMAGE_MAX_PIXELS,
  PDF_IMAGE_MAX_TOTAL_BYTES,
  PDF_RASTER_MAX_PAGES,
  resolvePdfPageSize,
  sanitizePdfFileName,
  type PdfImageFit,
  type PdfTargetOrientation,
  type PdfTargetPageSize,
} from "@/lib/pdf-conversion"
import { validateImageFile } from "@/lib/file-validation"

type ImageQueueItem = {
  id: string
  file: File
  width: number
  height: number
  mime: "image/jpeg" | "image/png" | "image/webp"
  previewUrl: string
}

type PdfPreview = { page: number; url: string }

const PDF_PAGE_SELECTOR_WINDOW = 60
const PDF_PREVIEW_PAGE_SIZE = 12

export type PdfFileHandoff = { id: string; file: File }

export function ImagesToPdfStudio({ onContinueToWorkspace }: { onContinueToWorkspace?: (file: File) => void }) {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef(new Set<string>())
  const cancelledRef = useRef(false)
  const [items, setItems] = useState<ImageQueueItem[]>([])
  const [adding, setAdding] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [draggedId, setDraggedId] = useState("")
  const [pageSize, setPageSize] = useState<PdfTargetPageSize>("original")
  const [orientation, setOrientation] = useState<PdfTargetOrientation>("auto")
  const [fit, setFit] = useState<PdfImageFit>("contain")
  const [margin, setMargin] = useState(18)
  const [outputName, setOutputName] = useState("tabnative-images.pdf")
  const [generatedPdf, setGeneratedPdf] = useState<File | null>(null)
  const [previewItemId, setPreviewItemId] = useState("")

  const previewItemIndex = useMemo(
    () => items.findIndex((item) => item.id === previewItemId),
    [items, previewItemId],
  )
  const previewItem = previewItemIndex >= 0 ? items[previewItemIndex] : null

  useEffect(() => () => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current.clear()
  }, [])

  async function addImages(files: readonly File[]) {
    if (!files.length || adding || running) return
    setAdding(true)
    setError("")
    setGeneratedPdf(null)
    const accepted: ImageQueueItem[] = []
    const rejected: string[] = []
    let totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)
    try {
      for (const file of files) {
        if (items.length + accepted.length >= PDF_IMAGE_MAX_FILES) {
          rejected.push(format("一次最多添加 {count} 张图片。", "Add up to {count} images at a time.", { count: PDF_IMAGE_MAX_FILES }))
          break
        }
        if (totalBytes + file.size > PDF_IMAGE_MAX_TOTAL_BYTES) {
          rejected.push(pick("图片合计不能超过 250 MB。", "Images cannot exceed 250 MB in total."))
          break
        }
        try {
          const validated = await validateImageFile(file, PDF_IMAGE_MAX_PIXELS)
          const previewUrl = URL.createObjectURL(validated.file)
          urlsRef.current.add(previewUrl)
          accepted.push({
            id: crypto.randomUUID(),
            file: validated.file,
            width: validated.width,
            height: validated.height,
            mime: validated.mime,
            previewUrl,
          })
          totalBytes += file.size
        } catch {
          rejected.push(format("{name}：不是可读取的 JPG、PNG 或 WebP 图片", "{name}: not a readable JPG, PNG, or WebP image", { name: file.name }))
        }
      }
      if (accepted.length) {
        setItems((current) => [...current, ...accepted])
        if (items.length === 0) setOutputName(`${baseName(accepted[0].file.name)}.pdf`)
      }
      setError(rejected.slice(0, 4).join("；"))
    } finally {
      setAdding(false)
    }
  }

  function removeItem(id: string) {
    if (previewItemId === id) setPreviewItemId("")
    setItems((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
        urlsRef.current.delete(removed.previewUrl)
      }
      return current.filter((item) => item.id !== id)
    })
  }

  function moveItem(index: number, offset: -1 | 1) {
    const target = index + offset
    if (target < 0 || target >= items.length) return
    setItems((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return
    setItems((current) => {
      const from = current.findIndex((item) => item.id === draggedId)
      const to = current.findIndex((item) => item.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moving] = next.splice(from, 1)
      next.splice(to, 0, moving)
      return next
    })
    setDraggedId("")
  }

  async function exportPdf() {
    if (!items.length || running) return
    setRunning(true)
    setError("")
    setProgress(1)
    cancelledRef.current = false
    try {
      const { PDFDocument } = await import("pdf-lib")
      const pdf = await PDFDocument.create()
      for (let index = 0; index < items.length; index++) {
        if (cancelledRef.current) throw new Error("cancelled")
        const item = items[index]
        const normalized = await normalizeImageForPdf(item)
        const embedded = normalized.mime === "image/jpeg"
          ? await pdf.embedJpg(normalized.bytes)
          : await pdf.embedPng(normalized.bytes)
        const size = resolvePdfPageSize(embedded.width, embedded.height, pageSize, orientation)
        const page = pdf.addPage([size.width, size.height])
        page.drawImage(embedded, layoutPdfImage(size.width, size.height, embedded.width, embedded.height, margin, fit))
        setProgress(Math.round(((index + 1) / items.length) * 82))
        await waitForBrowserPaint()
      }
      if (cancelledRef.current) throw new Error("cancelled")
      const bytes = await pdf.save()
      setProgress(96)
      const filename = sanitizePdfFileName(outputName, "tabnative-images")
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
      const file = new File([blob], filename, { type: "application/pdf", lastModified: Date.now() })
      setGeneratedPdf(file)
      downloadBlob(blob, filename)
      setProgress(100)
    } catch (reason) {
      if (!(reason instanceof Error && reason.message === "cancelled")) {
        setError(pick("无法生成 PDF。请减少图片数量或尺寸后重试。", "Unable to create the PDF. Retry with fewer or smaller images."))
      }
    } finally {
      setRunning(false)
    }
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Images className="size-5 text-cyan-500" />{pick("图片转 PDF 工作台", "Images to PDF workspace")}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{pick("添加、预览并排序图片，再统一设置纸张、方向、边距和填充方式。", "Add, preview, and reorder images, then apply one page size, orientation, margin, and fit rule.")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <button type="button" disabled={adding || running} aria-busy={adding} onClick={() => inputRef.current?.click()} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-5 text-center hover:border-cyan-500/50">
          {adding ? <LoaderCircle className="size-7 animate-spin text-cyan-500" /> : <FilePlus2 className="size-7 text-cyan-500" />}
          <span className="mt-2 text-sm font-semibold">{adding ? pick("正在读取图片", "Reading images") : pick("添加 JPG、PNG 或 WebP", "Add JPG, PNG, or WebP images")}</span>
          <span className="mt-1 text-xs text-muted-foreground">{format("最多 {count} 张 · 合计 250 MB · 单张最高 40 MP", "Up to {count} images · 250 MB total · 40 MP each", { count: PDF_IMAGE_MAX_FILES })}</span>
        </button>
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void addImages(Array.from(event.target.files ?? [])); event.currentTarget.value = "" }} />
        {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("部分图片未添加", "Some images were not added")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>

    {items.length ? <Card>
      <CardHeader><CardTitle>{pick("图片队列", "Image queue")}</CardTitle><p className="text-sm text-muted-foreground">{format("{count} 张 · {size} · 可拖动或使用箭头调整顺序", "{count} images · {size} · Drag or use the arrows to reorder", { count: items.length, size: formatBytes(items.reduce((sum, item) => sum + item.file.size, 0)) })}</p></CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => <article key={item.id} draggable={!running} onDragStart={() => setDraggedId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(item.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-muted/10 p-3">
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            <button
              type="button"
              disabled={running}
              onClick={() => setPreviewItemId(item.id)}
              aria-label={pick("预览", "Preview")}
              className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ddd_75%),linear-gradient(-45deg,transparent_75%,#ddd_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <img src={item.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
              <span className="absolute right-1 top-1 grid size-7 place-items-center rounded-md border border-white/25 bg-zinc-950/75 text-white shadow-sm transition group-hover:bg-zinc-950" aria-hidden="true"><Maximize2 className="size-3.5" /></span>
            </button>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{index + 1}. {item.file.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.width} × {item.height} · {formatBytes(item.file.size)}</p></div>
            <div className="grid shrink-0 gap-1">
              <Button size="icon-sm" variant="outline" disabled={index === 0 || running} onClick={() => moveItem(index, -1)} aria-label={pick("向前移动", "Move earlier")}><ArrowUp /></Button>
              <Button size="icon-sm" variant="outline" disabled={index === items.length - 1 || running} onClick={() => moveItem(index, 1)} aria-label={pick("向后移动", "Move later")}><ArrowDown /></Button>
              <Button size="icon-sm" variant="destructive" disabled={running} onClick={() => removeItem(item.id)} aria-label={pick("移除图片", "Remove image")}><Trash2 /></Button>
            </div>
          </article>)}
        </div>
      </CardContent>
    </Card> : null}

    {items.length ? <Card>
      <CardHeader><CardTitle>{pick("页面与导出设置", "Page and export settings")}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField label={pick("纸张尺寸", "Page size")} value={pageSize} onChange={(value) => setPageSize(value as PdfTargetPageSize)} options={[
            ["original", pick("跟随图片", "Match each image")], ["a4", "A4"], ["letter", "Letter"],
          ]} />
          <SelectField label={pick("页面方向", "Orientation")} value={orientation} onChange={(value) => setOrientation(value as PdfTargetOrientation)} options={[
            ["auto", pick("自动", "Auto")], ["portrait", pick("纵向", "Portrait")], ["landscape", pick("横向", "Landscape")],
          ]} />
          <SelectField label={pick("图片适配", "Image fit")} value={fit} onChange={(value) => setFit(value as PdfImageFit)} options={[
            ["contain", pick("完整显示", "Fit inside")], ["cover", pick("铺满页面", "Fill and crop")],
          ]} />
          <label className="space-y-2 text-sm"><span>{pick("页边距", "Margin")} · {margin} pt</span><input type="range" min={0} max={72} step={6} value={margin} onChange={(event) => setMargin(Number(event.target.value))} className="h-9 w-full accent-cyan-500" /></label>
        </div>
        <label className="block max-w-xl space-y-2 text-sm"><span>{pick("输出文件名", "Output filename")}</span><Input value={outputName} maxLength={120} onChange={(event) => setOutputName(event.target.value)} /></label>
        {running || progress ? <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[.06] p-4"><div className="flex justify-between text-sm"><span>{running ? pick("正在本地生成 PDF", "Creating the PDF locally") : pick("PDF 已生成", "PDF created")}</span><span>{progress}%</span></div><Progress value={progress} /></div> : null}
        {generatedPdf && onContinueToWorkspace ? <Alert className="border-emerald-500/30 bg-emerald-500/[.07] text-emerald-950 dark:text-emerald-100"><FileCheck2 /><AlertTitle>{pick("PDF 已准备好", "PDF is ready")}</AlertTitle><AlertDescription><p>{pick("可直接送入页面工作台继续合并、排序、拆分或压缩，无需重新上传。", "Send it directly to the page workspace to merge, reorder, split, or compress without uploading again.")}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => onContinueToWorkspace(generatedPdf)}>{pick("继续到页面工作台", "Continue to page workspace")}<ArrowRight /></Button></AlertDescription></Alert> : null}
        <div className="flex flex-wrap gap-2"><Button disabled={running} onClick={() => void exportPdf()}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{pick("生成并下载 PDF", "Create and download PDF")}</Button>{running ? <Button variant="outline" onClick={() => { cancelledRef.current = true }}><X />{pick("取消", "Cancel")}</Button> : null}</div>
      </CardContent>
    </Card> : null}

    <ImagePreviewDialog
      open={Boolean(previewItem)}
      title={previewItem?.file.name ?? ""}
      description={previewItem ? previewItem.width + " × " + previewItem.height + " · " + formatBytes(previewItem.file.size) + " · " + (previewItemIndex + 1) + " / " + items.length : ""}
      imageUrl={previewItem?.previewUrl ?? ""}
      imageAlt={previewItem?.file.name ?? ""}
      onClose={() => setPreviewItemId("")}
      onPrevious={() => {
        const previous = items[previewItemIndex - 1]
        if (previous) setPreviewItemId(previous.id)
      }}
      onNext={() => {
        const next = items[previewItemIndex + 1]
        if (next) setPreviewItemId(next.id)
      }}
      hasPrevious={previewItemIndex > 0}
      hasNext={previewItemIndex >= 0 && previewItemIndex < items.length - 1}
    />
  </div>
}

export function PdfToImagesStudio({ incomingPdf }: { incomingPdf?: PdfFileHandoff | null }) {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const renderRef = useRef<RenderTask | null>(null)
  const previewRenderRef = useRef<RenderTask | null>(null)
  const previewUrlRef = useRef("")
  const previewRequestRef = useRef(0)
  const thumbnailRenderRef = useRef<RenderTask | null>(null)
  const thumbnailRequestRef = useRef(0)
  const urlsRef = useRef(new Set<string>())
  const requestRef = useRef(0)
  const cancelledRef = useRef(false)
  const incomingRef = useRef("")
  const choosePdfRef = useRef<(file: File | undefined) => Promise<void>>(async () => undefined)
  const lastSelectedPageRef = useRef<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPageIndexes, setSelectedPageIndexes] = useState<Set<number>>(new Set())
  const [pageWindow, setPageWindow] = useState(0)
  const [selectionNotice, setSelectionNotice] = useState("")
  const [previews, setPreviews] = useState<PdfPreview[]>([])
  const [previewPage, setPreviewPage] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [formatName, setFormatName] = useState<"png" | "jpeg" | "webp">("png")
  const [scale, setScale] = useState(1.5)
  const [quality, setQuality] = useState(90)
  const [focusedPageIndex, setFocusedPageIndex] = useState<number | null>(null)
  const [pagePreview, setPagePreview] = useState<{ pageIndex: number | null; imageUrl: string; loading: boolean; error: string }>({
    pageIndex: null,
    imageUrl: "",
    loading: false,
    error: "",
  })

  const selectedPages = useMemo(
    () => [...selectedPageIndexes].sort((left, right) => left - right),
    [selectedPageIndexes],
  )
  const selectedPageSummary = useMemo(
    () => formatPdfPageSelection(selectedPages),
    [selectedPages],
  )
  const pageWindowCount = Math.max(1, Math.ceil(pageCount / PDF_PAGE_SELECTOR_WINDOW))
  const pageWindowStart = pageWindow * PDF_PAGE_SELECTOR_WINDOW
  const previewPageCount = Math.max(1, Math.ceil(pageCount / PDF_PREVIEW_PAGE_SIZE))
  const previewPageStart = previewPage * PDF_PREVIEW_PAGE_SIZE
  const previewPageEnd = Math.min(pageCount, previewPageStart + PDF_PREVIEW_PAGE_SIZE)
  const visiblePageIndexes = useMemo(
    () => Array.from(
      { length: Math.max(0, Math.min(PDF_PAGE_SELECTOR_WINDOW, pageCount - pageWindowStart)) },
      (_, index) => pageWindowStart + index,
    ),
    [pageCount, pageWindowStart],
  )

  useEffect(() => () => {
    requestRef.current += 1
    previewRequestRef.current += 1
    thumbnailRequestRef.current += 1
    try { renderRef.current?.cancel() } catch { /* Completed between checks. */ }
    try { previewRenderRef.current?.cancel() } catch { /* Completed between checks. */ }
    try { thumbnailRenderRef.current?.cancel() } catch { /* Completed between checks. */ }
    void pdfRef.current?.cleanup().catch(() => undefined)
    void pdfRef.current?.loadingTask.destroy().catch(() => undefined)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current.clear()
  }, [])

  async function renderPreviewPage(pdf: PDFDocumentProxy, nextPreviewPage: number) {
    const request = ++thumbnailRequestRef.current
    try { thumbnailRenderRef.current?.cancel() } catch { /* Completed between checks. */ }
    thumbnailRenderRef.current = null
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current.clear()
    setPreviews([])
    setPreviewLoading(true)
    setPreviewError("")

    const start = nextPreviewPage * PDF_PREVIEW_PAGE_SIZE
    const end = Math.min(pdf.numPages, start + PDF_PREVIEW_PAGE_SIZE)
    const nextPreviews: PdfPreview[] = []
    const generatedUrls: string[] = []
    let failedPages = 0

    for (let index = start; index < end; index++) {
      if (request !== thumbnailRequestRef.current) break
      let page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | null = null
      try {
        page = await pdf.getPage(index + 1)
        if (request !== thumbnailRequestRef.current) break
        const base = page.getViewport({ scale: 1 })
        const thumbnailScale = Math.min(0.45, 220 / Math.max(1, base.width))
        const viewport = page.getViewport({ scale: thumbnailScale })
        const canvas = document.createElement("canvas")
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext("2d")
        if (!context) throw new Error("canvas")
        const task = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" })
        thumbnailRenderRef.current = task
        await task.promise
        thumbnailRenderRef.current = null
        if (request !== thumbnailRequestRef.current) break
        const url = URL.createObjectURL(await canvasToBlob(canvas))
        generatedUrls.push(url)
        nextPreviews.push({ page: index + 1, url })
      } catch {
        if (request === thumbnailRequestRef.current) failedPages += 1
      } finally {
        page?.cleanup()
      }
    }

    if (request !== thumbnailRequestRef.current) {
      for (const url of generatedUrls) URL.revokeObjectURL(url)
      return
    }
    for (const url of generatedUrls) urlsRef.current.add(url)
    setPreviews(nextPreviews)
    setPreviewError(failedPages
      ? pick(
          "这一组有部分页面未能生成缩略图，你仍可通过页码选择并转换。",
          "Some pages in this group could not be previewed. You can still select and convert them by page number.",
        )
      : "")
    setPreviewLoading(false)
  }

  function changePreviewPage(nextPreviewPage: number) {
    const pdf = pdfRef.current
    if (!pdf || previewLoading || running || nextPreviewPage < 0 || nextPreviewPage >= previewPageCount) return
    const nextPageIndex = nextPreviewPage * PDF_PREVIEW_PAGE_SIZE
    setPreviewPage(nextPreviewPage)
    setFocusedPageIndex(nextPageIndex)
    setPageWindow(Math.floor(nextPageIndex / PDF_PAGE_SELECTOR_WINDOW))
    void renderPreviewPage(pdf, nextPreviewPage)
  }

  async function choosePdf(nextFile: File | undefined) {
    if (!nextFile || loading || running) return
    const request = ++requestRef.current
    setLoading(true)
    setError("")
    setProgress(0)
    try {
      const signature = new TextDecoder("latin1").decode(await nextFile.slice(0, 1_024).arrayBuffer())
      if (!signature.includes("%PDF-")) throw new Error("invalid")
      if (nextFile.size > 150 * 1024 * 1024) throw new Error("too-large")
      closePagePreview()
      thumbnailRequestRef.current += 1
      try { thumbnailRenderRef.current?.cancel() } catch { /* Completed between checks. */ }
      thumbnailRenderRef.current = null
      await disposePdfPreview(pdfRef, renderRef, urlsRef)
      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const loadingTask = pdfjs.getDocument({
        data: await nextFile.arrayBuffer(),
        useWorkerFetch: true,
        wasmUrl: "/pdfjs/wasm/",
      })
      const pdf = await loadingTask.promise
      if (request !== requestRef.current) {
        await pdf.loadingTask.destroy()
        return
      }
      pdfRef.current = pdf
      setFile(nextFile)
      setPageCount(pdf.numPages)
      setSelectedPageIndexes(new Set(buildPdfPageSelection(pdf.numPages)))
      setPageWindow(0)
      setPreviewPage(0)
      setFocusedPageIndex(0)
      setSelectionNotice(pdf.numPages > PDF_RASTER_MAX_PAGES
        ? format(
            "为控制浏览器内存，已选择前 {count} 页；你可以取消部分页面后再点选其他页。",
            "To protect browser memory, the first {count} pages were selected. Clear some pages to choose others.",
            { count: PDF_RASTER_MAX_PAGES },
          )
        : "")
      lastSelectedPageRef.current = null
      await renderPreviewPage(pdf, 0)
    } catch (reason) {
      if (request === requestRef.current) {
        const message = reason instanceof Error ? reason.message : ""
        setError(message === "too-large"
          ? pick("PDF 不能超过 150 MB。", "The PDF must be 150 MB or smaller.")
          : pick("无法读取这个 PDF。文件可能已损坏、加密或并非真实 PDF。", "Unable to read this PDF. It may be damaged, encrypted, or not an actual PDF."))
      }
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }
  useEffect(() => {
    choosePdfRef.current = choosePdf
  })

  useEffect(() => {
    if (!incomingPdf || incomingRef.current === incomingPdf.id) return
    incomingRef.current = incomingPdf.id
    void choosePdfRef.current(incomingPdf.file)
  }, [incomingPdf])

  function selectPreset(preset: "all" | "odd" | "even") {
    const pages = buildPdfPageSelection(pageCount, preset)
    setSelectedPageIndexes(new Set(pages))
    lastSelectedPageRef.current = pages.at(-1) ?? null
    setSelectionNotice(pageCount > PDF_RASTER_MAX_PAGES && preset === "all"
      ? format(
          "为控制浏览器内存，已选择前 {count} 页；你可以取消部分页面后再点选其他页。",
          "To protect browser memory, the first {count} pages were selected. Clear some pages to choose others.",
          { count: PDF_RASTER_MAX_PAGES },
        )
      : "")
    setError("")
  }

  function selectVisiblePageGroup() {
    const next = new Set(selectedPageIndexes)
    for (const pageIndex of visiblePageIndexes) {
      if (next.size >= PDF_RASTER_MAX_PAGES) break
      next.add(pageIndex)
    }
    setSelectedPageIndexes(next)
    setSelectionNotice(next.size >= PDF_RASTER_MAX_PAGES && visiblePageIndexes.some((pageIndex) => !next.has(pageIndex))
      ? format(
          "单次最多选择 {count} 页；请先取消部分页面。",
          "Select up to {count} pages per run. Clear some pages first.",
          { count: PDF_RASTER_MAX_PAGES },
        )
      : "")
    setError("")
  }

  function clearPageSelection() {
    setSelectedPageIndexes(new Set())
    lastSelectedPageRef.current = null
    setSelectionNotice("")
    setError("")
  }

  function togglePageSelection(pageIndex: number, extendRange = false) {
    const next = new Set(selectedPageIndexes)
    const lastSelected = lastSelectedPageRef.current
    if (extendRange && lastSelected !== null) {
      const start = Math.min(lastSelected, pageIndex)
      const end = Math.max(lastSelected, pageIndex)
      for (let candidate = start; candidate <= end; candidate++) {
        if (next.size >= PDF_RASTER_MAX_PAGES && !next.has(candidate)) break
        next.add(candidate)
      }
    } else if (next.has(pageIndex)) {
      next.delete(pageIndex)
    } else if (next.size < PDF_RASTER_MAX_PAGES) {
      next.add(pageIndex)
    }

    const reachedLimit = !next.has(pageIndex) && !selectedPageIndexes.has(pageIndex)
    setSelectedPageIndexes(next)
    setFocusedPageIndex(pageIndex)
    lastSelectedPageRef.current = pageIndex
    setSelectionNotice(reachedLimit
      ? format(
          "单次最多选择 {count} 页；请先取消部分页面。",
          "Select up to {count} pages per run. Clear some pages first.",
          { count: PDF_RASTER_MAX_PAGES },
        )
      : "")
    setError("")
  }

  function closePagePreview() {
    previewRequestRef.current += 1
    try { previewRenderRef.current?.cancel() } catch { /* Completed between checks. */ }
    previewRenderRef.current = null
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ""
    }
    setPagePreview({ pageIndex: null, imageUrl: "", loading: false, error: "" })
  }

  async function openPdfPagePreview(pageIndex: number) {
    const pdf = pdfRef.current
    if (!pdf || pageIndex < 0 || pageIndex >= pdf.numPages || running) return
    const request = ++previewRequestRef.current
    setFocusedPageIndex(pageIndex)
    try { previewRenderRef.current?.cancel() } catch { /* Completed between checks. */ }
    previewRenderRef.current = null
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ""
    }
    setPagePreview({ pageIndex, imageUrl: "", loading: true, error: "" })
    let page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | null = null
    try {
      page = await pdf.getPage(pageIndex + 1)
      if (request !== previewRequestRef.current) return
      const base = page.getViewport({ scale: 1 })
      const previewScale = Math.min(2, Math.max(0.75, 1_440 / Math.max(1, base.width, base.height)))
      const viewport = page.getViewport({ scale: previewScale })
      const canvas = document.createElement("canvas")
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext("2d")
      if (!context) throw new Error("canvas")
      const task = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" })
      previewRenderRef.current = task
      await task.promise
      previewRenderRef.current = null
      if (request !== previewRequestRef.current) return
      const url = URL.createObjectURL(await canvasToBlob(canvas))
      if (request !== previewRequestRef.current) {
        URL.revokeObjectURL(url)
        return
      }
      previewUrlRef.current = url
      setPagePreview({ pageIndex, imageUrl: url, loading: false, error: "" })
    } catch {
      if (request === previewRequestRef.current) {
        previewRenderRef.current = null
        setPagePreview({
          pageIndex,
          imageUrl: "",
          loading: false,
          error: pick("无法生成这一页的大图预览，你仍可选择并转换该页。", "Unable to create a large preview for this page. You can still select and convert it."),
        })
      }
    } finally {
      page?.cleanup()
    }
  }

  async function exportImages() {
    const pdf = pdfRef.current
    if (!pdf || !file || running) return
    if (!selectedPages.length) {
      setError(pick("请先点选至少一页。", "Select at least one page."))
      return
    }
    if (selectedPages.length > PDF_RASTER_MAX_PAGES) {
      setError(format("一次最多转换 {count} 页，请取消部分页面。", "Convert up to {count} pages at a time; clear some selected pages.", { count: PDF_RASTER_MAX_PAGES }))
      return
    }
    setRunning(true)
    setError("")
    setProgress(1)
    cancelledRef.current = false
    try {
      const JSZip = selectedPages.length > 1 ? (await import("jszip")).default : null
      const zip = JSZip ? new JSZip() : null
      let singleBlob: Blob | null = null
      let singleName = ""
      for (let outputIndex = 0; outputIndex < selectedPages.length; outputIndex++) {
        if (cancelledRef.current) throw new Error("cancelled")
        const pageIndex = selectedPages[outputIndex]
        const page = await pdf.getPage(pageIndex + 1)
        try {
          const viewport = page.getViewport({ scale })
          const pixels = Math.ceil(viewport.width) * Math.ceil(viewport.height)
          if (pixels > PDF_IMAGE_MAX_PIXELS) throw new Error("too-many-pixels")
          const canvas = document.createElement("canvas")
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext("2d")
          if (!context) throw new Error("canvas")
          if (formatName !== "png") {
            context.fillStyle = "#ffffff"
            context.fillRect(0, 0, canvas.width, canvas.height)
          }
          const task = page.render({ canvas, canvasContext: context, viewport, background: formatName === "png" ? undefined : "#ffffff" })
          renderRef.current = task
          await task.promise
          renderRef.current = null
          const mime = `image/${formatName}`
          const blob = await canvasToBlob(canvas, mime, formatName === "png" ? undefined : quality / 100)
          const name = `${baseName(file.name)}-page-${pageIndex + 1}.${formatName === "jpeg" ? "jpg" : formatName}`
          if (zip) zip.file(name, blob)
          else { singleBlob = blob; singleName = name }
        } finally {
          page.cleanup()
        }
        setProgress(Math.round(((outputIndex + 1) / selectedPages.length) * (zip ? 82 : 96)))
        await waitForBrowserPaint()
      }
      if (cancelledRef.current) throw new Error("cancelled")
      if (zip) {
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (metadata) => setProgress(82 + Math.round(metadata.percent * 0.17)))
        downloadBlob(blob, `${baseName(file.name)}-images.zip`)
      } else if (singleBlob) {
        downloadBlob(singleBlob, singleName)
      }
      setProgress(100)
    } catch (reason) {
      if (!(reason instanceof Error && reason.message === "cancelled")) {
        setError(reason instanceof Error && reason.message === "too-many-pixels"
          ? pick("当前倍率会生成过大的图片，请降低倍率后重试。", "This scale would create an oversized image. Choose a lower scale and retry.")
          : pick("无法完成图片转换。请减少所选页面或降低倍率。", "Unable to convert the pages. Select fewer pages or lower the scale."))
      }
    } finally {
      renderRef.current = null
      setRunning(false)
    }
  }

  function cancelExport() {
    cancelledRef.current = true
    try { renderRef.current?.cancel() } catch { /* Completed between checks. */ }
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileImage className="size-5 text-cyan-500" />{pick("PDF 转图片工作台", "PDF to images workspace")}</CardTitle><p className="text-sm leading-6 text-muted-foreground">{pick("预览后直接点选需要导出的页面，再转换为 PNG、JPG 或 WebP；多页自动打包为 ZIP。", "Preview and click the pages you want to export as PNG, JPG, or WebP; multiple pages are bundled in a ZIP.")}</p></CardHeader>
      <CardContent className="space-y-4">
        <button type="button" disabled={loading || running} aria-busy={loading} onClick={() => inputRef.current?.click()} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-5 text-center hover:border-cyan-500/50">
          {loading ? <LoaderCircle className="size-7 animate-spin text-cyan-500" /> : <FilePlus2 className="size-7 text-cyan-500" />}
          <span className="mt-2 text-sm font-semibold">{loading ? pick("正在读取并生成预览", "Reading and creating previews") : pick("选择一个 PDF", "Choose one PDF")}</span>
          <span className="mt-1 text-xs font-medium text-muted-foreground">{pick("单个最大 150 MB · 每组预览 12 页", "150 MB maximum · 12 previews per group")}</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { void choosePdf(event.target.files?.[0]); event.currentTarget.value = "" }} />
        {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("无法完成转换", "Unable to complete conversion")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>

    {file && pageCount ? <Card>
      <CardHeader><CardTitle>{file.name}</CardTitle><p className="text-sm text-muted-foreground">{format("{pages} 页 · {size}", "{pages} pages · {size}", { pages: pageCount, size: formatBytes(file.size) })}</p></CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-3" aria-labelledby="pdf-page-previews">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h3 id="pdf-page-previews" className="text-sm font-semibold text-foreground">{pick("页面预览", "Page previews")}</h3>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{format("第 {start}-{end} 页，共 {count} 页", "Pages {start}-{end} of {count}", { start: previewPageStart + 1, end: previewPageEnd, count: pageCount })}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                disabled={running || previewLoading || previewPage === 0}
                onClick={() => changePreviewPage(previewPage - 1)}
                aria-label={pick("上一组页面", "Previous page group")}
                className="border-slate-300 bg-white text-slate-900 shadow-sm hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-800 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-cyan-500/10"
              ><ChevronLeft /></Button>
              <span className="min-w-16 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-slate-900 dark:border-border dark:bg-muted/40 dark:text-foreground">{previewPage + 1} / {previewPageCount}</span>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={running || previewLoading || previewPage >= previewPageCount - 1}
                onClick={() => changePreviewPage(previewPage + 1)}
                aria-label={pick("下一组页面", "Next page group")}
                className="border-slate-300 bg-white text-slate-900 shadow-sm hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-800 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-cyan-500/10"
              ><ChevronRight /></Button>
            </div>
          </div>

          {previewLoading ? <div role="status" aria-label={pick("正在读取并生成预览", "Reading and creating previews")} className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {Array.from({ length: Math.max(1, previewPageEnd - previewPageStart) }, (_, index) => <div key={index} className="aspect-[.72] animate-pulse rounded-lg border border-slate-300 bg-slate-100 dark:border-border dark:bg-muted/35" />)}
          </div> : null}

          {!previewLoading && previews.length ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {previews.map((preview) => {
              const pageIndex = preview.page - 1
              const selected = selectedPageIndexes.has(pageIndex)
              return <div key={preview.url} className={selected ? "relative overflow-hidden rounded-lg border border-cyan-700 bg-white shadow-sm ring-2 ring-cyan-700/35 dark:border-cyan-400 dark:ring-cyan-400/35" : "relative overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition hover:border-cyan-600 dark:border-zinc-700 dark:hover:border-cyan-400"}>
                <button
                  type="button"
                  disabled={running}
                  aria-pressed={selected}
                  aria-label={format("选择第 {page} 页", "Select page {page}", { page: preview.page })}
                  onClick={(event) => togglePageSelection(pageIndex, event.shiftKey)}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <img src={preview.url} alt={format("第 {page} 页预览", "Preview of page {page}", { page: preview.page })} className="aspect-[.72] w-full bg-white object-contain" />
                  <span className={selected ? "flex items-center justify-center gap-1 border-t border-cyan-800 bg-cyan-700 py-1.5 text-center text-xs font-bold text-white dark:border-cyan-300 dark:bg-cyan-400 dark:text-slate-950" : "flex items-center justify-center gap-1 border-t border-slate-200 bg-slate-100 py-1.5 text-center text-xs font-semibold text-slate-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"}>{selected ? <Check className="size-3.5" strokeWidth={2.75} /> : null}{preview.page}</span>
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void openPdfPagePreview(pageIndex)}
                  aria-label={format("第 {page} 页预览", "Preview of page {page}", { page: preview.page })}
                  className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-lg border border-slate-300 bg-white/95 text-slate-900 shadow-md transition hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/25 dark:bg-zinc-950/90 dark:text-white dark:hover:bg-zinc-900"
                ><Maximize2 className="size-4" strokeWidth={2.5} /></button>
              </div>
            })}
          </div> : null}

          {previewError ? <p role="status" className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{previewError}</p> : null}
          {pageCount > PDF_PREVIEW_PAGE_SIZE ? <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{format("全部 {count} 页均可预览，每组显示 {size} 页；使用箭头切换。", "All {count} pages can be previewed in groups of {size}. Use the arrows to switch groups.", { count: pageCount, size: PDF_PREVIEW_PAGE_SIZE })}</p> : null}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-muted/10 p-4" aria-labelledby="pdf-image-page-selection">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <h3 id="pdf-image-page-selection" className="text-sm font-semibold">{pick("选择导出页面", "Select pages")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{format("已选择 {count} 页", "{count} pages selected", { count: selectedPages.length })}{selectedPageSummary ? ` · ${selectedPageSummary}` : ""}</p>
            </div>
            <Button size="sm" variant="outline" disabled={running} onClick={() => selectPreset("all")}>{pageCount > PDF_RASTER_MAX_PAGES ? format("选择前 {count} 页", "Select first {count} pages", { count: PDF_RASTER_MAX_PAGES }) : pick("全选", "Select all")}</Button>
            <Button size="sm" variant="outline" disabled={running || !selectedPages.length} onClick={clearPageSelection}>{pick("取消选择", "Clear selection")}</Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="outline" disabled={running || pageWindow === 0} onClick={() => setPageWindow((current) => Math.max(0, current - 1))} aria-label={pick("上一组页面", "Previous page group")}><ChevronLeft /></Button>
            <span className="min-w-0 flex-1 text-center text-xs font-medium text-muted-foreground">{pageWindowStart + 1}-{Math.min(pageCount, pageWindowStart + PDF_PAGE_SELECTOR_WINDOW)} / {pageCount}</span>
            <Button size="sm" variant="outline" disabled={running || selectedPages.length >= PDF_RASTER_MAX_PAGES} onClick={selectVisiblePageGroup}>{pick("选择当前组", "Select current group")}</Button>
            <Button size="icon-sm" variant="outline" disabled={running || pageWindow >= pageWindowCount - 1} onClick={() => setPageWindow((current) => Math.min(pageWindowCount - 1, current + 1))} aria-label={pick("下一组页面", "Next page group")}><ChevronRight /></Button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2" role="group" aria-label={pick("可选择的 PDF 页面", "Selectable PDF pages")}>
            {visiblePageIndexes.map((pageIndex) => {
              const selected = selectedPageIndexes.has(pageIndex)
              return <button
                key={pageIndex}
                type="button"
                disabled={running}
                aria-pressed={selected}
                title={format("第 {page} 页", "Page {page}", { page: pageIndex + 1 })}
                onClick={(event) => togglePageSelection(pageIndex, event.shiftKey)}
                className={`h-10 rounded-lg border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 ${selected ? "border-cyan-800 bg-cyan-700 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-400 dark:text-slate-950" : "border-slate-300 bg-white text-slate-900 hover:border-cyan-600 hover:bg-cyan-50 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-cyan-500/10"}`}
              >{pageIndex + 1}</button>
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-5 text-muted-foreground">{format("单击选择或取消页面；按住 Shift 可连续选择。单次最多 {count} 页。", "Click to select or clear pages; hold Shift to select a continuous range. Up to {count} pages per run.", { count: PDF_RASTER_MAX_PAGES })}</p>
            <Button size="sm" variant="outline" disabled={running || focusedPageIndex === null} onClick={() => { if (focusedPageIndex !== null) void openPdfPagePreview(focusedPageIndex) }}><Maximize2 />{focusedPageIndex === null ? pick("预览", "Preview") : format("第 {page} 页预览", "Preview of page {page}", { page: focusedPageIndex + 1 })}</Button>
          </div>
          {selectionNotice ? <p role="status" className="rounded-lg border border-amber-500/25 bg-amber-500/[.08] px-3 py-2 text-xs leading-5 text-amber-900 dark:text-amber-100">{selectionNotice}</p> : null}
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectField label={pick("输出格式", "Output format")} value={formatName} onChange={(value) => setFormatName(value as "png" | "jpeg" | "webp")} options={[["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]]} />
          <SelectField label={pick("清晰度倍率", "Resolution scale")} value={String(scale)} onChange={(value) => setScale(Number(value))} options={[["1", "1×"], ["1.5", "1.5×"], ["2", "2×"]]} />
          {formatName !== "png" ? <label className="space-y-2 text-sm"><span>{pick("图片质量", "Image quality")} · {quality}%</span><input type="range" min={60} max={100} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="h-9 w-full accent-cyan-500" /></label> : <div className="rounded-xl border border-border bg-muted/15 p-3 text-xs leading-5 text-muted-foreground"><Package className="mb-1 size-4 text-cyan-500" />{pick("多页结果自动打包为 ZIP；单页直接下载图片。", "Multiple pages are bundled in a ZIP; a single page downloads directly.")}</div>}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{format("单次最多转换 {count} 页。更高倍率更清晰，也会占用更多内存。", "Up to {count} pages per run. Higher scales are sharper and use more memory.", { count: PDF_RASTER_MAX_PAGES })}</p>
        {running || progress ? <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[.06] p-4"><div className="flex justify-between text-sm"><span>{running ? pick("正在逐页转换", "Converting pages") : pick("转换完成", "Conversion complete")}</span><span>{progress}%</span></div><Progress value={progress} /></div> : null}
        <div className="flex flex-wrap gap-2"><Button disabled={running || !selectedPages.length} onClick={() => void exportImages()}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{pick("转换并下载", "Convert and download")}</Button>{running ? <Button variant="outline" onClick={cancelExport}><X />{pick("取消", "Cancel")}</Button> : null}</div>
      </CardContent>
    </Card> : null}

    <ImagePreviewDialog
      open={pagePreview.pageIndex !== null}
      title={pagePreview.pageIndex === null ? "" : format("第 {page} 页预览", "Preview of page {page}", { page: pagePreview.pageIndex + 1 })}
      description={file?.name ?? ""}
      imageUrl={pagePreview.imageUrl}
      imageAlt={pagePreview.pageIndex === null ? "" : format("第 {page} 页预览", "Preview of page {page}", { page: pagePreview.pageIndex + 1 })}
      loading={pagePreview.loading}
      error={pagePreview.error}
      onClose={closePagePreview}
      onPrevious={() => { if (pagePreview.pageIndex !== null) void openPdfPagePreview(pagePreview.pageIndex - 1) }}
      onNext={() => { if (pagePreview.pageIndex !== null) void openPdfPagePreview(pagePreview.pageIndex + 1) }}
      hasPrevious={pagePreview.pageIndex !== null && pagePreview.pageIndex > 0}
      hasNext={pagePreview.pageIndex !== null && pagePreview.pageIndex < pageCount - 1}
    />
  </div>
}

function ImagePreviewDialog({
  open,
  title,
  description,
  imageUrl,
  imageAlt,
  loading = false,
  error = "",
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: {
  open: boolean
  title: string
  description: string
  imageUrl: string
  imageAlt: string
  loading?: boolean
  error?: string
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}) {
  const { pick } = useLanguage()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
      else if (event.key === "ArrowLeft" && hasPrevious) onPrevious?.()
      else if (event.key === "ArrowRight" && hasNext) onNext?.()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious, open])

  if (!open) return null

  return <div
    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-label={title || pick("预览", "Preview")}
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
  >
    <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
          {description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Button size="icon-sm" variant="outline" onClick={onClose} aria-label={pick("关闭", "Close")}><X /></Button>
      </header>
      <div className="relative flex min-h-72 flex-1 items-center justify-center overflow-hidden bg-zinc-950 p-4 sm:min-h-[32rem] sm:p-6">
        {loading ? <div role="status" className="flex flex-col items-center gap-3 text-sm text-zinc-200"><LoaderCircle className="size-7 animate-spin text-cyan-400" />{pick("正在读取并生成预览", "Reading and creating previews")}</div> : null}
        {!loading && error ? <div role="alert" className="max-w-md rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-center text-sm leading-6 text-red-100">{error}</div> : null}
        {!loading && !error && imageUrl ? <img src={imageUrl} alt={imageAlt} className="max-h-[72vh] max-w-full object-contain" /> : null}
        {hasPrevious ? <button type="button" onClick={onPrevious} aria-label={pick("上一张", "Previous image")} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><ChevronLeft /></button> : null}
        {hasNext ? <button type="button" onClick={onNext} aria-label={pick("下一张", "Next image")} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><ChevronRight /></button> : null}
      </div>
    </div>
  </div>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="space-y-2 text-sm"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>
}

async function normalizeImageForPdf(item: ImageQueueItem) {
  const bitmap = await createImageBitmap(item.file, { imageOrientation: "from-image" })
  try {
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    if (item.mime === "image/jpeg") {
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(bitmap, 0, 0)
    const mime = item.mime === "image/jpeg" ? "image/jpeg" : "image/png"
    const blob = await canvasToBlob(canvas, mime, mime === "image/jpeg" ? 0.94 : undefined)
    return { mime, bytes: new Uint8Array(await blob.arrayBuffer()) }
  } finally {
    bitmap.close()
  }
}

async function disposePdfPreview(
  pdfRef: { current: PDFDocumentProxy | null },
  renderRef: { current: RenderTask | null },
  urlsRef: { current: Set<string> },
) {
  try { renderRef.current?.cancel() } catch { /* Completed between checks. */ }
  renderRef.current = null
  const pdf = pdfRef.current
  pdfRef.current = null
  if (pdf) {
    await pdf.cleanup().catch(() => undefined)
    await pdf.loadingTask.destroy().catch(() => undefined)
  }
  for (const url of urlsRef.current) URL.revokeObjectURL(url)
  urlsRef.current.clear()
}
