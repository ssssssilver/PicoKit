"use client"

/* eslint-disable @next/next/no-img-element -- previews are local object URLs. */

import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  FileCheck2,
  FileImage,
  FilePlus2,
  GripVertical,
  Images,
  LoaderCircle,
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
  layoutPdfImage,
  parsePdfPageSpec,
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
            <figure className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ddd_75%),linear-gradient(-45deg,transparent_75%,#ddd_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0px]">
              <img src={item.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
            </figure>
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
  </div>
}

export function PdfToImagesStudio({ incomingPdf }: { incomingPdf?: PdfFileHandoff | null }) {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const renderRef = useRef<RenderTask | null>(null)
  const urlsRef = useRef(new Set<string>())
  const requestRef = useRef(0)
  const cancelledRef = useRef(false)
  const incomingRef = useRef("")
  const choosePdfRef = useRef<(file: File | undefined) => Promise<void>>(async () => undefined)
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageSpec, setPageSpec] = useState("")
  const [previews, setPreviews] = useState<PdfPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [formatName, setFormatName] = useState<"png" | "jpeg" | "webp">("png")
  const [scale, setScale] = useState(1.5)
  const [quality, setQuality] = useState(90)

  const selectedPages = useMemo(() => parsePdfPageSpec(pageSpec, pageCount), [pageCount, pageSpec])

  useEffect(() => () => {
    requestRef.current += 1
    try { renderRef.current?.cancel() } catch { /* Completed between checks. */ }
    void pdfRef.current?.cleanup().catch(() => undefined)
    void pdfRef.current?.loadingTask.destroy().catch(() => undefined)
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current.clear()
  }, [])

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
      setPageSpec(pdf.numPages > 1 ? `1-${pdf.numPages}` : "1")
      const nextPreviews: PdfPreview[] = []
      for (let index = 0; index < Math.min(12, pdf.numPages); index++) {
        if (request !== requestRef.current) return
        const page = await pdf.getPage(index + 1)
        try {
          const base = page.getViewport({ scale: 1 })
          const previewScale = Math.min(0.45, 220 / Math.max(1, base.width))
          const viewport = page.getViewport({ scale: previewScale })
          const canvas = document.createElement("canvas")
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext("2d")
          if (!context) continue
          const task = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" })
          renderRef.current = task
          await task.promise
          renderRef.current = null
          const url = URL.createObjectURL(await canvasToBlob(canvas))
          urlsRef.current.add(url)
          nextPreviews.push({ page: index + 1, url })
        } finally {
          page.cleanup()
        }
      }
      if (request === requestRef.current) setPreviews(nextPreviews)
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

  async function exportImages() {
    const pdf = pdfRef.current
    if (!pdf || !file || running) return
    if (!selectedPages.length) {
      setError(pick("请输入有效页码，例如 1-3,5。", "Enter a valid page range, such as 1-3,5."))
      return
    }
    if (selectedPages.length > PDF_RASTER_MAX_PAGES) {
      setError(format("一次最多转换 {count} 页，请缩小页码范围。", "Convert up to {count} pages at a time; narrow the page range.", { count: PDF_RASTER_MAX_PAGES }))
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
          : pick("无法完成图片转换。请缩小页码范围或降低倍率。", "Unable to convert the pages. Narrow the range or lower the scale."))
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
      <CardHeader><CardTitle className="flex items-center gap-2"><FileImage className="size-5 text-cyan-500" />{pick("PDF 转图片工作台", "PDF to images workspace")}</CardTitle><p className="text-sm leading-6 text-muted-foreground">{pick("先预览页面，再按页码范围导出 PNG、JPG 或 WebP；多页自动打包为 ZIP。", "Preview the document, then export a page range as PNG, JPG, or WebP; multiple pages are bundled in a ZIP.")}</p></CardHeader>
      <CardContent className="space-y-4">
        <button type="button" disabled={loading || running} aria-busy={loading} onClick={() => inputRef.current?.click()} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-5 text-center hover:border-cyan-500/50">
          {loading ? <LoaderCircle className="size-7 animate-spin text-cyan-500" /> : <FilePlus2 className="size-7 text-cyan-500" />}
          <span className="mt-2 text-sm font-semibold">{loading ? pick("正在读取并生成预览", "Reading and creating previews") : pick("选择一个 PDF", "Choose one PDF")}</span>
          <span className="mt-1 text-xs text-muted-foreground">{pick("单个最大 150 MB · 最多预览前 12 页", "150 MB maximum · previews for the first 12 pages")}</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { void choosePdf(event.target.files?.[0]); event.currentTarget.value = "" }} />
        {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("无法完成转换", "Unable to complete conversion")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>

    {file && pageCount ? <Card>
      <CardHeader><CardTitle>{file.name}</CardTitle><p className="text-sm text-muted-foreground">{format("{pages} 页 · {size}", "{pages} pages · {size}", { pages: pageCount, size: formatBytes(file.size) })}</p></CardHeader>
      <CardContent className="space-y-5">
        {previews.length ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {previews.map((preview) => <figure key={preview.url} className="overflow-hidden rounded-lg border border-border bg-white"><img src={preview.url} alt={format("第 {page} 页预览", "Preview of page {page}", { page: preview.page })} className="aspect-[.72] w-full object-contain" /><figcaption className="bg-zinc-950 py-1 text-center text-xs text-zinc-300">{preview.page}</figcaption></figure>)}
        </div> : null}
        {pageCount > 12 ? <p className="text-xs text-muted-foreground">{format("仅预览前 12 页，全部 {count} 页仍可按范围转换。", "Only the first 12 pages are previewed; all {count} pages remain available by range.", { count: pageCount })}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm"><span>{pick("页码范围", "Page range")}</span><Input value={pageSpec} onChange={(event) => setPageSpec(event.target.value)} placeholder="1-3,5" /><span className="block text-xs text-muted-foreground">{format("已选择 {count} 页", "{count} pages selected", { count: selectedPages.length })}</span></label>
          <SelectField label={pick("输出格式", "Output format")} value={formatName} onChange={(value) => setFormatName(value as "png" | "jpeg" | "webp")} options={[["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]]} />
          <SelectField label={pick("清晰度倍率", "Resolution scale")} value={String(scale)} onChange={(value) => setScale(Number(value))} options={[["1", "1×"], ["1.5", "1.5×"], ["2", "2×"]]} />
          {formatName !== "png" ? <label className="space-y-2 text-sm"><span>{pick("图片质量", "Image quality")} · {quality}%</span><input type="range" min={60} max={100} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="h-9 w-full accent-cyan-500" /></label> : <div className="rounded-xl border border-border bg-muted/15 p-3 text-xs leading-5 text-muted-foreground"><Package className="mb-1 size-4 text-cyan-500" />{pick("多页结果自动打包为 ZIP；单页直接下载图片。", "Multiple pages are bundled in a ZIP; a single page downloads directly.")}</div>}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{format("单次最多转换 {count} 页。更高倍率更清晰，也会占用更多内存。", "Up to {count} pages per run. Higher scales are sharper and use more memory.", { count: PDF_RASTER_MAX_PAGES })}</p>
        {running || progress ? <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[.06] p-4"><div className="flex justify-between text-sm"><span>{running ? pick("正在逐页转换", "Converting pages") : pick("转换完成", "Conversion complete")}</span><span>{progress}%</span></div><Progress value={progress} /></div> : null}
        <div className="flex flex-wrap gap-2"><Button disabled={running || !selectedPages.length} onClick={() => void exportImages()}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{pick("转换并下载", "Convert and download")}</Button>{running ? <Button variant="outline" onClick={cancelExport}><X />{pick("取消", "Cancel")}</Button> : null}</div>
      </CardContent>
    </Card> : null}
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
