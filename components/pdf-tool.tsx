"use client"

/* eslint-disable @next/next/no-img-element -- PDF thumbnails use local blob URLs that Next Image cannot optimize. */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Download,
  FilePlus2,
  Hash,
  Layers3,
  LoaderCircle,
  RotateCw,
  Scissors,
  Stamp,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { PdfWorkspace } from "@/components/pdf-workspace"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { baseName, canvasToBlob, downloadBlob, formatBytes, safeError } from "@/lib/browser-files"
import {
  createPdfPagePlan,
  deletePdfPage,
  detectPdfImageFormat,
  movePdfPage,
  organizePdfBytes,
  rotatePdfPage,
  type PdfImageFormat,
  type PdfPagePlanItem,
} from "@/lib/pdf-organizer"

type Mode = "workspace" | "organize" | "merge" | "pages" | "images" | "export"
type PdfInfo = { file: File; pages: number }
type PdfJsDestroyable = { destroy: () => Promise<void> | void }
type PdfJsDocument = { cleanup: () => Promise<void> | void; loadingTask: PdfJsDestroyable }
type PdfJsRenderTask = { cancel: () => void; promise: Promise<unknown> }

const maxPdfBytes = 150 * 1024 * 1024
const maxThumbnailCount = 60

export function PdfTool() {
  const { pick, format } = useLanguage()
  const [mode, setMode] = useState<Mode>("workspace")
  const [files, setFiles] = useState<PdfInfo[]>([])
  const [images, setImages] = useState<File[]>([])
  const [pageSpec, setPageSpec] = useState("1")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [thumbs, setThumbs] = useState<Array<string | null>>([])
  const [pagePlan, setPagePlan] = useState<PdfPagePlanItem[]>([])
  const [pagePlanSource, setPagePlanSource] = useState("")
  const [addPageNumbers, setAddPageNumbers] = useState(false)
  const [pageNumberStart, setPageNumberStart] = useState(1)
  const [addWatermark, setAddWatermark] = useState(false)
  const [watermarkText, setWatermarkText] = useState("")
  const [watermarkOpacity, setWatermarkOpacity] = useState(18)
  const thumbnailRequest = useRef(0)
  const thumbnailLoadingTask = useRef<PdfJsDestroyable | null>(null)
  const thumbnailPdf = useRef<PdfJsDocument | null>(null)
  const thumbnailRenderTask = useRef<PdfJsRenderTask | null>(null)
  const thumbnailUrls = useRef(new Set<string>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const trackedThumbnailUrls = thumbnailUrls.current
    return () => {
      mounted.current = false
      thumbnailRequest.current += 1
      safelyCancelPdfJsRender(thumbnailRenderTask.current)
      thumbnailRenderTask.current = null
      void safelyDestroyPdfJs(thumbnailLoadingTask.current)
      void safelyDestroyPdfJs(thumbnailPdf.current?.loadingTask ?? null)
      thumbnailLoadingTask.current = null
      thumbnailPdf.current = null
      revokeObjectUrls(trackedThumbnailUrls)
    }
  }, [])

  function invalidateThumbnailPreview(clearState = true) {
    thumbnailRequest.current += 1
    safelyCancelPdfJsRender(thumbnailRenderTask.current)
    thumbnailRenderTask.current = null
    void safelyDestroyPdfJs(thumbnailLoadingTask.current)
    void safelyDestroyPdfJs(thumbnailPdf.current?.loadingTask ?? null)
    thumbnailLoadingTask.current = null
    thumbnailPdf.current = null
    revokeObjectUrls(thumbnailUrls.current)
    if (clearState && mounted.current) setThumbs([])
  }

  function thumbnailRequestIsCurrent(request: number) {
    return mounted.current && request === thumbnailRequest.current
  }

  async function addPdfs(list: FileList | null) {
    if (!list?.length) return
    invalidateThumbnailPreview()
    setFiles([])
    setPagePlan([])
    setPagePlanSource("")
    setError("")
    const selectionRequest = thumbnailRequest.current
    try {
      const { PDFDocument } = await import("pdf-lib")
      const next: PdfInfo[] = []
      for (const file of Array.from(list)) {
        if (file.size > maxPdfBytes) throw new Error(pick("单个 PDF 不能超过 150 MB", "Each PDF must be 150 MB or smaller"))
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })
        if (!thumbnailRequestIsCurrent(selectionRequest)) return
        next.push({ file, pages: doc.getPageCount() })
      }

      if (!thumbnailRequestIsCurrent(selectionRequest)) return
      setFiles(next)
      if (mode === "merge") {
        return
      }

      const first = next[0]
      if (first) prepareSinglePdf(first)
    } catch (reason) {
      if (thumbnailRequestIsCurrent(selectionRequest)) {
        setError(safeError(reason, pick("无法读取 PDF", "Unable to read PDF")))
      }
    }
  }

  function prepareSinglePdf(info: PdfInfo) {
    const sourceKey = pdfFileKey(info.file)
    setPagePlan(createPdfPagePlan(info.pages))
    setPagePlanSource(sourceKey)
    setPageSpec(info.pages > 1 ? `1-${info.pages}` : "1")
    void renderThumbs(info.file, info.pages)
  }

  async function renderThumbs(file: File, totalPages: number) {
    invalidateThumbnailPreview()
    const request = thumbnailRequest.current
    const previewCount = Math.min(totalPages, maxThumbnailCount)
    setThumbs(Array.from({ length: previewCount }, () => null))
    const urls: Array<string | null> = Array.from({ length: previewCount }, () => null)
    let activeRenderTask: PdfJsRenderTask | null = null

    try {
      const pdfjs = await import("pdfjs-dist")
      if (!thumbnailRequestIsCurrent(request)) return
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const data = await file.arrayBuffer()
      if (!thumbnailRequestIsCurrent(request)) return
      const loadingTask = pdfjs.getDocument({ data })
      thumbnailLoadingTask.current = loadingTask
      const pdf = await loadingTask.promise
      if (thumbnailLoadingTask.current === loadingTask) thumbnailLoadingTask.current = null
      if (!thumbnailRequestIsCurrent(request)) {
        await safelyDestroyPdfJs(pdf.loadingTask)
        return
      }
      thumbnailPdf.current = pdf

      try {
        for (let index = 1; index <= previewCount; index++) {
          if (!thumbnailRequestIsCurrent(request)) break
          const page = await pdf.getPage(index)
          if (!thumbnailRequestIsCurrent(request)) break
          const viewport = page.getViewport({ scale: 0.26 })
          const canvas = document.createElement("canvas")
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext("2d")
          if (!context) continue
          const renderTask = page.render({ canvas, canvasContext: context, viewport })
          activeRenderTask = renderTask
          thumbnailRenderTask.current = renderTask
          await renderTask.promise
          if (thumbnailRenderTask.current === renderTask) thumbnailRenderTask.current = null
          activeRenderTask = null
          if (!thumbnailRequestIsCurrent(request)) break
          const url = URL.createObjectURL(await canvasToBlob(canvas))
          if (!thumbnailRequestIsCurrent(request)) {
            URL.revokeObjectURL(url)
            break
          }
          urls[index - 1] = url
          thumbnailUrls.current.add(url)
        }

        if (thumbnailRequestIsCurrent(request)) setThumbs(urls)
        else revokeThumbnailUrls(urls, thumbnailUrls.current)
      } finally {
        if (activeRenderTask) {
          safelyCancelPdfJsRender(activeRenderTask)
          if (thumbnailRenderTask.current === activeRenderTask) thumbnailRenderTask.current = null
        }
        if (thumbnailPdf.current === pdf) thumbnailPdf.current = null
        await safelyCleanupAndDestroyPdfJs(pdf)
      }
    } catch {
      if (thumbnailRequestIsCurrent(request)) {
        revokeObjectUrls(thumbnailUrls.current)
        setThumbs([])
      } else {
        revokeThumbnailUrls(urls, thumbnailUrls.current)
      }
    } finally {
      const loadingTask = thumbnailLoadingTask.current
      if (loadingTask && thumbnailRequestIsCurrent(request)) {
        thumbnailLoadingTask.current = null
        await safelyDestroyPdfJs(loadingTask)
      }
    }
  }

  function chooseMode(nextMode: Mode) {
    setMode(nextMode)
    setError("")
    if (nextMode === "workspace") return
    if (nextMode === "images" || nextMode === "merge") {
      invalidateThumbnailPreview()
      setPagePlan([])
      setPagePlanSource("")
      return
    }

    const first = files[0]
    if (!first) return
    if (files.length > 1) setFiles([first])
    const sourceKey = pdfFileKey(first.file)
    if (sourceKey !== pagePlanSource) prepareSinglePdf(first)
  }

  async function run() {
    setRunning(true)
    setError("")
    try {
      if (mode === "images") return await imagesToPdf()
      if (!files.length) throw new Error(pick("请先选择 PDF 文件", "Choose a PDF file first"))
      if (mode === "organize") return await exportOrganizedPdf()
      if (mode === "merge") return await mergePdfs()
      if (mode === "export") return await exportImages()
      return await editPages()
    } catch (reason) {
      setError(safeError(reason, pick("PDF 处理失败", "PDF processing failed")))
    } finally {
      setRunning(false)
    }
  }

  async function exportOrganizedPdf() {
    if (!pagePlan.length) throw new Error(pick("PDF 至少需要保留一页", "Keep at least one page in the PDF"))
    if (addWatermark && !watermarkText.trim()) {
      throw new Error(pick("请输入水印文字，或关闭文字水印", "Enter watermark text or turn off the text watermark"))
    }

    const watermark = addWatermark
      ? {
          pngBytes: await renderWatermarkText(watermarkText.trim()),
          opacity: watermarkOpacity / 100,
        }
      : null
    const bytes = await organizePdfBytes(await files[0].file.arrayBuffer(), pagePlan, {
      pageNumbers: addPageNumbers,
      pageNumberStart,
      watermark,
    })
    downloadBlob(
      new Blob([bytes as BlobPart], { type: "application/pdf" }),
      `${baseName(files[0].file.name)}-organized.pdf`,
    )
  }

  async function mergePdfs() {
    const { PDFDocument } = await import("pdf-lib")
    const output = await PDFDocument.create()
    for (const item of files) {
      const source = await PDFDocument.load(await item.file.arrayBuffer())
      const pages = await output.copyPages(source, source.getPageIndices())
      pages.forEach((page) => output.addPage(page))
    }
    downloadBlob(new Blob([await output.save() as BlobPart], { type: "application/pdf" }), "tabnative-merged.pdf")
  }

  async function editPages() {
    const { PDFDocument, degrees } = await import("pdf-lib")
    const source = await PDFDocument.load(await files[0].file.arrayBuffer())
    const selected = parsePages(pageSpec, source.getPageCount())
    if (!selected.length) throw new Error(pick("页码范围无效", "The page range is invalid"))
    const select = document.querySelector("#pdf-page-action") as HTMLSelectElement | null
    const action = select?.value ?? "extract"

    if (action === "extract") {
      const output = await PDFDocument.create()
      const pages = await output.copyPages(source, selected)
      pages.forEach((page) => output.addPage(page))
      downloadBlob(new Blob([await output.save() as BlobPart], { type: "application/pdf" }), `${baseName(files[0].file.name)}-pages.pdf`)
    } else if (action === "delete") {
      if (selected.length >= source.getPageCount()) throw new Error(pick("PDF 至少需要保留一页", "Keep at least one page in the PDF"))
      ;[...selected].sort((a, b) => b - a).forEach((index) => source.removePage(index))
      downloadBlob(new Blob([await source.save() as BlobPart], { type: "application/pdf" }), `${baseName(files[0].file.name)}-trimmed.pdf`)
    } else {
      selected.forEach((index) => {
        const page = source.getPage(index)
        page.setRotation(degrees((page.getRotation().angle + 90) % 360))
      })
      downloadBlob(new Blob([await source.save() as BlobPart], { type: "application/pdf" }), `${baseName(files[0].file.name)}-rotated.pdf`)
    }
  }

  async function imagesToPdf() {
    if (!images.length) throw new Error(pick("请选择图片", "Choose one or more images"))
    const { PDFDocument } = await import("pdf-lib")
    const pdf = await PDFDocument.create()
    for (const file of images) {
      const sourceBytes = new Uint8Array(await file.arrayBuffer())
      const imageFormat = detectPdfImageFormat(sourceBytes.subarray(0, 16))
      if (!imageFormat) {
        throw new Error(format(
          "“{name}”的实际内容不是受支持的 JPG 或 PNG 图片。",
          'The actual contents of "{name}" are not a supported JPG or PNG image.',
          { name: file.name },
        ))
      }

      let normalized: Uint8Array
      try {
        normalized = await normalizePdfImage(sourceBytes, imageFormat)
      } catch {
        throw new Error(format(
          "浏览器无法解码“{name}”，文件可能已损坏。",
          'The browser could not decode "{name}"; the file may be damaged.',
          { name: file.name },
        ))
      }

      const image = imageFormat === "png" ? await pdf.embedPng(normalized) : await pdf.embedJpg(normalized)
      const page = pdf.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    }
    downloadBlob(new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), "tabnative-images.pdf")
  }

  async function exportImages() {
    const pdfjs = await import("pdfjs-dist")
    const JSZip = (await import("jszip")).default
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
    const loadingTask = pdfjs.getDocument({ data: await files[0].file.arrayBuffer() })
    let loaded = false
    try {
      const pdf = await loadingTask.promise
      loaded = true
      try {
        const selected = parsePages(pageSpec, pdf.numPages)
        if (!selected.length) throw new Error(pick("页码范围无效", "The page range is invalid"))
        const zip = new JSZip()
        for (const index of selected) {
          const page = await pdf.getPage(index + 1)
          const viewport = page.getViewport({ scale: 2 })
          const canvas = document.createElement("canvas")
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext("2d")
          if (!context) continue
          await page.render({ canvas, canvasContext: context, viewport }).promise
          zip.file(`page-${index + 1}.png`, await canvasToBlob(canvas))
        }
        downloadBlob(await zip.generateAsync({ type: "blob" }), `${baseName(files[0].file.name)}-images.zip`)
      } finally {
        await safelyCleanupAndDestroyPdfJs(pdf)
      }
    } finally {
      if (!loaded) await safelyDestroyPdfJs(loadingTask)
    }
  }

  const actionIcon = mode === "organize"
    ? <Layers3 />
    : mode === "merge"
      ? <FilePlus2 />
      : mode === "pages"
        ? <Scissors />
        : mode === "export"
          ? <Download />
          : <FilePlus2 />

  const legacyTools = <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>{mode === "images" ? pick("图片转 PDF", "Images to PDF") : pick("PDF 转图片", "PDF to images")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {mode === "images"
          ? <FilePicker
              accept="image/png,image/jpeg"
              multiple
              label={pick("选择 JPG 或 PNG 图片", "Choose JPG or PNG images")}
              onChange={(list) => setImages(Array.from(list ?? []))}
            />
          : <FilePicker
              accept="application/pdf,.pdf"
              multiple={mode === "merge"}
              label={mode === "merge" ? pick("选择多个 PDF", "Choose multiple PDFs") : pick("选择一个 PDF", "Choose one PDF")}
              onChange={(list) => void addPdfs(list)}
            />}

        {mode !== "images" && files.length ? <div className="space-y-2">
          {files.map((item, index) => (
            <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3 text-sm">
              <span className="min-w-0 truncate">{item.file.name}</span>
              <span className="shrink-0 text-zinc-500">{item.pages} {pick("页", "pages")} · {formatBytes(item.file.size)}</span>
            </div>
          ))}
        </div> : null}

        {files.length && (mode === "organize" || mode === "merge" || mode === "pages") ? <Alert className="border-amber-500/30 bg-amber-500/[.06] text-amber-950 dark:text-amber-100">
          <AlertTriangle />
          <AlertTitle>{pick("导出会重建 PDF", "Export rebuilds the PDF")}</AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-100/75">
            {pick(
              "数字签名通常会失效；交互表单、书签、附件及其他文档级结构可能无法保留。请先保留原文件，并在导出后重新检查这些内容。",
              "Digital signatures will usually become invalid. Interactive forms, bookmarks, attachments, and other document-level structures may not be preserved. Keep the original and verify the exported file.",
            )}
          </AlertDescription>
        </Alert> : null}

        {(mode === "pages" || mode === "export") && files.length ? <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>{pick("页码范围，例如 1-3,5", "Page range, e.g. 1-3,5")}</span>
            <Input value={pageSpec} onChange={(event) => setPageSpec(event.target.value)} />
          </label>
          {mode === "pages" ? <label className="space-y-2 text-sm">
            <span>{pick("操作", "Action")}</span>
            <select id="pdf-page-action" className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
              <option value="extract">{pick("提取所选页", "Extract selected pages")}</option>
              <option value="delete">{pick("删除所选页", "Delete selected pages")}</option>
              <option value="rotate">{pick("顺时针旋转 90°", "Rotate 90° clockwise")}</option>
            </select>
          </label> : null}
        </div> : null}

        {mode === "organize" && files[0] ? <OrganizerExportOptions
          addPageNumbers={addPageNumbers}
          setAddPageNumbers={setAddPageNumbers}
          pageNumberStart={pageNumberStart}
          setPageNumberStart={setPageNumberStart}
          addWatermark={addWatermark}
          setAddWatermark={setAddWatermark}
          watermarkText={watermarkText}
          setWatermarkText={setWatermarkText}
          watermarkOpacity={watermarkOpacity}
          setWatermarkOpacity={setWatermarkOpacity}
          pick={pick}
        /> : null}

        {images.length && mode === "images" ? <p className="text-sm text-zinc-500">{pick("已选择", "Selected")} {images.length} {pick("张图片", "images")}</p> : null}

        <Button size="lg" onClick={run} disabled={running}>
          {running ? <LoaderCircle className="animate-spin" /> : actionIcon}
          {running
            ? pick("正在本地处理", "Processing locally")
            : mode === "organize"
              ? pick("导出整理后的 PDF", "Export organized PDF")
              : pick("开始处理并下载", "Process and download")}
        </Button>

        {error ? <Alert variant="destructive">
          <Trash2 />
          <AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert> : null}
      </CardContent>
    </Card>

    {mode === "organize" && files[0] ? <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{pick("页面顺序", "Page order")}</span>
          <span className="font-mono text-xs font-normal text-zinc-500">
            {format("保留 {kept} / {total} 页", "{kept} / {total} pages kept", { kept: pagePlan.length, total: files[0].pages })}
          </span>
        </CardTitle>
        <p className="text-sm leading-6 text-zinc-500">
          {pick("使用按钮调整顺序、逐页旋转或删除。这里只修改导出计划，原始 PDF 不会改变。", "Move, rotate, or remove individual pages. These controls only change the export plan; the source PDF stays untouched.")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-2">
          {pagePlan.map((page, index) => {
            const thumbnail = thumbs[page.sourceIndex]
            return <div key={page.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[.02] p-3">
              <figure className="flex aspect-[.7] w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white">
                {thumbnail
                  ? <img src={thumbnail} alt={format("原始第 {page} 页预览", "Preview of source page {page}", { page: page.sourceIndex + 1 })} className="size-full object-contain" />
                  : <Layers3 className="size-5 text-zinc-500" aria-hidden="true" />}
              </figure>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{format("第 {page} 页", "Page {page}", { page: index + 1 })}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {format("来自原始第 {page} 页", "From source page {page}", { page: page.sourceIndex + 1 })}
                  {page.rotation ? ` · +${page.rotation}°` : ""}
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setPagePlan((current) => movePdfPage(current, index, -1))}
                  aria-label={format("上移第 {page} 页", "Move page {page} up", { page: index + 1 })}
                  title={pick("上移", "Move up")}
                ><ArrowUp /></Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={index === pagePlan.length - 1}
                  onClick={() => setPagePlan((current) => movePdfPage(current, index, 1))}
                  aria-label={format("下移第 {page} 页", "Move page {page} down", { page: index + 1 })}
                  title={pick("下移", "Move down")}
                ><ArrowDown /></Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setPagePlan((current) => rotatePdfPage(current, index))}
                  aria-label={format("旋转第 {page} 页", "Rotate page {page}", { page: index + 1 })}
                  title={pick("顺时针旋转 90°", "Rotate 90° clockwise")}
                ><RotateCw /></Button>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  disabled={pagePlan.length <= 1}
                  onClick={() => setPagePlan((current) => deletePdfPage(current, index))}
                  aria-label={format("删除第 {page} 页", "Delete page {page}", { page: index + 1 })}
                  title={pick("删除此页", "Delete this page")}
                ><Trash2 /></Button>
              </div>
            </div>
          })}
        </div>
        {files[0].pages > maxThumbnailCount ? <p className="text-xs leading-5 text-zinc-500">
          {format("为控制浏览器内存，仅生成前 {count} 页缩略图；所有 {total} 页仍可排序、旋转和删除。", "To limit browser memory, thumbnails are generated for the first {count} pages; all {total} pages can still be reordered, rotated, or removed.", { count: maxThumbnailCount, total: files[0].pages })}
        </p> : null}
      </CardContent>
    </Card> : null}

    {(mode === "pages" || mode === "export") && thumbs.some(Boolean) ? <Card>
      <CardHeader><CardTitle>{pick("页面预览（前 12 页）", "Page preview (first 12 pages)")}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {thumbs.slice(0, 12).map((url, index) => url ? <figure key={url} className="overflow-hidden rounded-md border border-white/10 bg-white">
            <img src={url} alt={format("第 {page} 页预览", "Preview of page {page}", { page: index + 1 })} className="aspect-[.7] w-full object-contain" />
            <figcaption className="bg-[#111] py-1 text-center text-xs text-zinc-500">{index + 1}</figcaption>
          </figure> : null)}
        </div>
      </CardContent>
    </Card> : null}
  </div>

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle>{pick("PDF 工具箱", "PDF toolbox")}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {(["workspace", "images", "export"] as Mode[]).map((item) => <Button key={item} variant={mode === item ? "default" : "outline"} onClick={() => chooseMode(item)}>
            {item === "workspace" ? pick("页面工作台", "Page workspace") : item === "images" ? pick("图片转 PDF", "Images to PDF") : pick("PDF 转图片", "PDF to images")}
          </Button>)}
        </div>
      </CardContent>
    </Card>
    <div className={mode === "workspace" ? "" : "hidden"}><PdfWorkspace /></div>
    <div className={mode === "workspace" ? "hidden" : ""}>{legacyTools}</div>
  </div>
}

function revokeObjectUrls(urls: Set<string>) {
  for (const url of urls) URL.revokeObjectURL(url)
  urls.clear()
}

function revokeThumbnailUrls(urls: readonly (string | null)[], tracked: Set<string>) {
  for (const url of urls) {
    if (!url) continue
    URL.revokeObjectURL(url)
    tracked.delete(url)
  }
}

function safelyCancelPdfJsRender(task: PdfJsRenderTask | null) {
  try {
    task?.cancel()
  } catch {
    // The render may have completed between invalidation and cancellation.
  }
}

async function safelyDestroyPdfJs(resource: PdfJsDestroyable | null) {
  if (!resource) return
  try {
    await resource.destroy()
  } catch {
    // A cancelled loading/render task may already have destroyed the same worker.
  }
}

async function safelyCleanupAndDestroyPdfJs(resource: PdfJsDocument) {
  try {
    await resource.cleanup()
  } catch {
    // Cleanup is best effort; destroy still needs to run.
  }
  await safelyDestroyPdfJs(resource.loadingTask)
}

async function normalizePdfImage(bytes: Uint8Array, format: PdfImageFormat) {
  const mime = format === "png" ? "image/png" : "image/jpeg"
  const decoded = await decodePdfImage(new Blob([bytes as BlobPart], { type: mime }))
  try {
    if (!decoded.width || !decoded.height) throw new Error("The image has no usable pixels")
    const canvas = document.createElement("canvas")
    canvas.width = decoded.width
    canvas.height = decoded.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is unavailable")
    if (format === "jpeg") {
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
    const normalized = await canvasToBlob(canvas, mime, format === "jpeg" ? 0.95 : undefined)
    return new Uint8Array(await normalized.arrayBuffer())
  } finally {
    decoded.close()
  }
}

async function decodePdfImage(blob: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = url
    await image.decode()
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function OrganizerExportOptions({
  addPageNumbers,
  setAddPageNumbers,
  pageNumberStart,
  setPageNumberStart,
  addWatermark,
  setAddWatermark,
  watermarkText,
  setWatermarkText,
  watermarkOpacity,
  setWatermarkOpacity,
  pick,
}: {
  addPageNumbers: boolean
  setAddPageNumbers: (value: boolean) => void
  pageNumberStart: number
  setPageNumberStart: (value: number) => void
  addWatermark: boolean
  setAddWatermark: (value: boolean) => void
  watermarkText: string
  setWatermarkText: (value: string) => void
  watermarkOpacity: number
  setWatermarkOpacity: (value: number) => void
  pick: (zh: string, en: string) => string
}) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={addPageNumbers} onChange={(event) => setAddPageNumbers(event.target.checked)} className="mt-1 size-4 accent-cyan-300" />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4 text-cyan-300" />{pick("添加页码", "Add page numbers")}</span>
          <span className="mt-1 block text-xs leading-5 text-zinc-500">{pick("页码显示在每页底部中央。", "Page numbers appear at the bottom center of every page.")}</span>
        </span>
      </label>
      {addPageNumbers ? <label className="mt-3 block text-xs text-zinc-500">
        <span>{pick("起始页码", "Starting number")}</span>
        <Input type="number" min={1} max={999999} value={pageNumberStart} onChange={(event) => setPageNumberStart(Math.max(1, Number(event.target.value) || 1))} className="mt-2" />
      </label> : null}
    </div>

    <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={addWatermark} onChange={(event) => setAddWatermark(event.target.checked)} className="mt-1 size-4 accent-cyan-300" />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold"><Stamp className="size-4 text-cyan-300" />{pick("添加文字水印", "Add text watermark")}</span>
          <span className="mt-1 block text-xs leading-5 text-zinc-500">{pick("文字会在本地渲染后置于每页中央。", "Text is rendered locally and placed in the center of every page.")}</span>
        </span>
      </label>
      {addWatermark ? <div className="mt-3 space-y-3">
        <Input value={watermarkText} maxLength={80} placeholder={pick("例如：内部资料", "For example: Internal")} onChange={(event) => setWatermarkText(event.target.value)} />
        <label className="block text-xs text-zinc-500">
          <span>{pick("不透明度", "Opacity")} · {watermarkOpacity}%</span>
          <input type="range" min={5} max={60} step={1} value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.target.value))} className="mt-2 w-full accent-cyan-300" />
        </label>
      </div> : null}
    </div>
  </div>
}

function FilePicker({ accept, multiple, label, onChange }: { accept: string; multiple?: boolean; label: string; onChange: (files: FileList | null) => void }) {
  return <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[.02] px-4 text-center hover:border-cyan-300/40">
    <FilePlus2 className="mb-2 size-6 text-cyan-300" />
    <span className="text-sm font-medium">{label}</span>
    <input className="sr-only" type="file" accept={accept} multiple={multiple} onChange={(event) => onChange(event.target.files)} />
  </label>
}

async function renderWatermarkText(text: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 1600
  canvas.height = 600
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is unavailable")

  const fontSize = Math.max(54, Math.min(116, 1150 / Math.sqrt(Math.max(1, text.length))))
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(-Math.PI / 10)
  context.font = `700 ${fontSize}px Arial, "Microsoft YaHei", "Noto Sans", sans-serif`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.lineJoin = "round"
  context.lineWidth = Math.max(4, fontSize / 14)
  context.strokeStyle = "#ffffff"
  context.fillStyle = "#111111"
  context.strokeText(text, 0, 0, 1320)
  context.fillText(text, 0, 0, 1320)

  return new Uint8Array(await (await canvasToBlob(canvas, "image/png")).arrayBuffer())
}

function pdfFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function parsePages(spec: string, total: number) {
  const values = new Set<number>()
  for (const token of spec.split(",").map((item) => item.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:-(\d+))?$/)
    if (!match) continue
    const rawStart = Number(match[1])
    const rawEnd = Number(match[2] ?? match[1])
    if (rawStart > total || rawEnd < 1) continue
    const start = Math.max(1, rawStart)
    const end = Math.min(total, rawEnd)
    for (let page = Math.min(start, end); page <= Math.max(start, end); page++) {
      if (page <= total) values.add(page - 1)
    }
  }
  return [...values]
}
