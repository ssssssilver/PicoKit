"use client"

/* eslint-disable @next/next/no-img-element -- PDF thumbnails are generated locally as blob URLs. */

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckSquare2,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FilePlus2,
  GripVertical,
  Hash,
  Layers3,
  LoaderCircle,
  Redo2,
  RotateCcw,
  RotateCw,
  Stamp,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { baseName, canvasToBlob, downloadBlob, formatBytes } from "@/lib/browser-files"
import { sanitizePdfFileName } from "@/lib/pdf-conversion"
import {
  createPdfWorkspacePages,
  deletePdfWorkspacePages,
  movePdfWorkspacePages,
  movePdfWorkspaceSelection,
  PDF_MAX_BATCH_BYTES,
  PDF_MAX_FILE_BYTES,
  PDF_MAX_SOURCE_COUNT,
  PDF_MAX_WORKSPACE_PAGES,
  reorderPdfWorkspaceSources,
  rotatePdfWorkspacePages,
  type PdfWorkspacePage,
} from "@/lib/pdf-organizer"

type WorkspaceSource = { id: string; file: File; pages: number; color: string }
type HistoryState = { past: PdfWorkspacePage[][]; future: PdfWorkspacePage[][] }
type PreviewPending = { resolve: (value: number | Blob) => void; reject: (reason: Error) => void }
type PreviewMessage = {
  type: "source-loaded" | "thumbnail" | "error"
  requestId: string
  pages?: number
  blob?: Blob
  code?: string
  error?: string
}
type ExportMessage = {
  type: "progress" | "result" | "error"
  requestId: string
  completed?: number
  total?: number
  buffer?: ArrayBuffer
  code?: string
  error?: string
}
type DeliveryResult = {
  blob: Blob
  filename: string
  pages: number
  bytes: number
  selectedOnly: boolean
  metadataMode: "clear" | "custom"
  sourceNames: string[]
}

const sourceColors = ["#22d3ee", "#a78bfa", "#fb7185", "#fbbf24", "#34d399", "#60a5fa", "#f97316", "#c084fc"]
const historyLimit = 50

export function PdfWorkspace() {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const pagePlanRef = useRef<PdfWorkspacePage[]>([])
  const historyRef = useRef<HistoryState>({ past: [], future: [] })
  const draggedIdsRef = useRef<Set<string>>(new Set())
  const selectionAnchorRef = useRef("")
  const exportWorkerRef = useRef<Worker | null>(null)
  const exportRejectRef = useRef<((reason: Error) => void) | null>(null)
  const exportCancelledRef = useRef(false)
  const preview = usePdfPreviewWorker()

  const [sources, setSources] = useState<WorkspaceSource[]>([])
  const [pagePlan, setPagePlan] = useState<PdfWorkspacePage[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [historyAvailability, setHistoryAvailability] = useState({ canUndo: false, canRedo: false })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [addPageNumbers, setAddPageNumbers] = useState(false)
  const [pageNumberStart, setPageNumberStart] = useState(1)
  const [addWatermark, setAddWatermark] = useState(false)
  const [watermarkText, setWatermarkText] = useState("")
  const [watermarkOpacity, setWatermarkOpacity] = useState(18)
  const [outputName, setOutputName] = useState("tabnative-organized.pdf")
  const [metadataMode, setMetadataMode] = useState<"clear" | "custom">("clear")
  const [documentTitle, setDocumentTitle] = useState("")
  const [documentAuthor, setDocumentAuthor] = useState("")
  const [documentSubject, setDocumentSubject] = useState("")
  const [documentKeywords, setDocumentKeywords] = useState("")
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null)

  useEffect(() => () => {
    exportWorkerRef.current?.terminate()
    exportWorkerRef.current = null
  }, [])

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])
  const visiblePages = useMemo(() => pagePlan.filter((page) => !collapsedSources.has(page.sourceId)), [collapsedSources, pagePlan])
  const totalSourcePages = useMemo(() => sources.reduce((sum, source) => sum + source.pages, 0), [sources])
  const selectedPages = useMemo(() => pagePlan.filter((page) => selectedIds.has(page.id)), [pagePlan, selectedIds])
  const { canUndo, canRedo } = historyAvailability

  function commitPlan(nextOrUpdate: PdfWorkspacePage[] | ((current: PdfWorkspacePage[]) => PdfWorkspacePage[])) {
    const current = pagePlanRef.current
    const next = typeof nextOrUpdate === "function" ? nextOrUpdate(current) : nextOrUpdate
    if (plansEqual(current, next)) return
    historyRef.current.past = [...historyRef.current.past.slice(-(historyLimit - 1)), current]
    historyRef.current.future = []
    pagePlanRef.current = next
    setPagePlan(next)
    setHistoryAvailability({ canUndo: historyRef.current.past.length > 0, canRedo: false })
  }

  function replacePlanAfterSourceChange(next: PdfWorkspacePage[]) {
    // Page history is valid only while the set and order of source files stay
    // unchanged. Clearing it here prevents undo from restoring pages whose
    // source document was removed or moved independently.
    historyRef.current = { past: [], future: [] }
    pagePlanRef.current = next
    setPagePlan(next)
    setSelectedIds(new Set())
    setHistoryAvailability({ canUndo: false, canRedo: false })
  }

  function undo() {
    const previous = historyRef.current.past.at(-1)
    if (!previous) return
    historyRef.current.past = historyRef.current.past.slice(0, -1)
    historyRef.current.future = [pagePlanRef.current, ...historyRef.current.future].slice(0, historyLimit)
    pagePlanRef.current = previous
    setPagePlan(previous)
    setSelectedIds(new Set())
    setHistoryAvailability({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 })
  }

  function redo() {
    const next = historyRef.current.future[0]
    if (!next) return
    historyRef.current.future = historyRef.current.future.slice(1)
    historyRef.current.past = [...historyRef.current.past, pagePlanRef.current].slice(-historyLimit)
    pagePlanRef.current = next
    setPagePlan(next)
    setSelectedIds(new Set())
    setHistoryAvailability({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 })
  }

  async function addFiles(files: readonly File[]) {
    if (!files.length || adding) return
    setAdding(true)
    setError("")
    setNotice(pick("正在逐个检查 PDF，请稍候。", "Checking PDFs one at a time."))
    const accepted: WorkspaceSource[] = []
    const rejected: string[] = []
    const known = new Set(sources.map((source) => fileFingerprint(source.file)))
    let totalBytes = sources.reduce((sum, source) => sum + source.file.size, 0)
    let totalPages = sources.reduce((sum, source) => sum + source.pages, 0)

    try {
      for (const file of files) {
        if (sources.length + accepted.length >= PDF_MAX_SOURCE_COUNT) {
          rejected.push(format("工作台最多加入 {count} 个 PDF。", "The workspace accepts up to {count} PDFs.", { count: PDF_MAX_SOURCE_COUNT }))
          break
        }
        if (file.size > PDF_MAX_FILE_BYTES) {
          rejected.push(format("{name}：单个 PDF 最大 150 MB", "{name}: each PDF must be 150 MB or smaller", { name: file.name }))
          continue
        }
        if (totalBytes + file.size > PDF_MAX_BATCH_BYTES) {
          rejected.push(pick("工作台中的 PDF 合计不能超过 300 MB。", "PDFs in the workspace cannot exceed 300 MB in total."))
          break
        }
        const fingerprint = fileFingerprint(file)
        if (known.has(fingerprint)) {
          rejected.push(format("{name}：已经在工作台中", "{name}: already in the workspace", { name: file.name }))
          continue
        }
        const signature = new TextDecoder("latin1").decode(await file.slice(0, 1_024).arrayBuffer())
        if (!signature.includes("%PDF-")) {
          rejected.push(format("{name}：实际内容不是 PDF", "{name}: the actual contents are not a PDF", { name: file.name }))
          continue
        }

        const id = crypto.randomUUID()
        try {
          const pages = await preview.loadSource(id, await file.arrayBuffer())
          if (totalPages + pages > PDF_MAX_WORKSPACE_PAGES) {
            preview.releaseSource(id)
            rejected.push(format("工作台最多处理 {count} 页。", "The workspace supports up to {count} pages.", { count: PDF_MAX_WORKSPACE_PAGES }))
            break
          }
          accepted.push({ id, file, pages, color: sourceColors[(sources.length + accepted.length) % sourceColors.length] })
          totalBytes += file.size
          totalPages += pages
          known.add(fingerprint)
        } catch (reason) {
          rejected.push(`${file.name}：${previewErrorText(reason, pick)}`)
        }
      }

      if (accepted.length) {
        setSources((current) => [...current, ...accepted])
        if (!sources.length) setOutputName(`${baseName(accepted[0].file.name)}-organized.pdf`)
        replacePlanAfterSourceChange([
          ...pagePlanRef.current,
          ...accepted.flatMap((source) => createPdfWorkspacePages(source.id, source.pages)),
        ])
        setNotice(format("已加入 {files} 个 PDF，共 {pages} 页。", "Added {files} PDFs with {pages} pages.", {
          files: accepted.length,
          pages: accepted.reduce((sum, source) => sum + source.pages, 0),
        }))
      } else {
        setNotice("")
      }
      setError(rejected.slice(0, 4).join("；"))
    } finally {
      setAdding(false)
    }
  }

  function selectPage(pageId: string, event: ReactMouseEvent) {
    const index = pagePlan.findIndex((page) => page.id === pageId)
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = pagePlan.findIndex((page) => page.id === selectionAnchorRef.current)
      if (anchorIndex >= 0 && index >= 0) {
        const [start, end] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex]
        setSelectedIds(new Set(pagePlan.slice(start, end + 1).map((page) => page.id)))
        return
      }
    }
    selectionAnchorRef.current = pageId
    if (event.ctrlKey || event.metaKey) {
      setSelectedIds((current) => {
        const next = new Set(current)
        if (next.has(pageId)) next.delete(pageId)
        else next.add(pageId)
        return next
      })
      return
    }
    setSelectedIds(new Set([pageId]))
  }

  function startPageDrag(pageId: string, event: DragEvent<HTMLElement>) {
    const dragged = selectedIds.has(pageId) ? new Set(selectedIds) : new Set([pageId])
    if (!selectedIds.has(pageId)) setSelectedIds(dragged)
    draggedIdsRef.current = dragged
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", pageId)
  }

  function dropPages(targetId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const targetIndex = pagePlanRef.current.findIndex((page) => page.id === targetId)
    if (targetIndex < 0 || !draggedIdsRef.current.size) return
    commitPlan((current) => movePdfWorkspacePages(current, draggedIdsRef.current, targetIndex))
    draggedIdsRef.current = new Set()
  }

  function removeSelectedPages() {
    if (!selectedIds.size) return
    if (selectedIds.size >= pagePlan.length) {
      setError(pick("PDF 至少需要保留一页。", "Keep at least one page in the PDF."))
      return
    }
    commitPlan((current) => deletePdfWorkspacePages(current, selectedIds))
    setSelectedIds(new Set())
  }

  function removeSource(source: WorkspaceSource) {
    if (!window.confirm(format("从工作台移除“{name}”及其所有页面？", 'Remove "{name}" and all of its pages from the workspace?', { name: source.file.name }))) return
    preview.releaseSource(source.id)
    setSources((current) => current.filter((item) => item.id !== source.id))
    replacePlanAfterSourceChange(pagePlanRef.current.filter((page) => page.sourceId !== source.id))
    setSelectedIds((current) => new Set([...current].filter((id) => !id.startsWith(`${source.id}-page-`))))
    setCollapsedSources((current) => new Set([...current].filter((id) => id !== source.id)))
  }

  function moveSource(sourceIndex: number, direction: -1 | 1) {
    const target = sourceIndex + direction
    if (target < 0 || target >= sources.length) return
    const next = [...sources]
    ;[next[sourceIndex], next[target]] = [next[target], next[sourceIndex]]
    setSources(next)
    replacePlanAfterSourceChange(reorderPdfWorkspaceSources(pagePlanRef.current, next.map((source) => source.id)))
  }

  function resetWorkspace() {
    commitPlan(sources.flatMap((source) => createPdfWorkspacePages(source.id, source.pages)))
    setSelectedIds(new Set())
    setCollapsedSources(new Set())
  }

  async function exportPages(pages: PdfWorkspacePage[], selectedOnly: boolean) {
    if (!pages.length || running) return
    if (addWatermark && !watermarkText.trim()) {
      setError(pick("请输入水印文字，或关闭文字水印。", "Enter watermark text or turn off the text watermark."))
      return
    }
    setRunning(true)
    setError("")
    setDelivery(null)
    setProgress(1)
    setProgressText(pick("正在读取源文件", "Reading source files"))
    exportCancelledRef.current = false
    const worker = new Worker(new URL("../workers/pdf-export.worker.ts", import.meta.url), { type: "module" })
    exportWorkerRef.current = worker

    try {
      const requiredIds = new Set(pages.map((page) => page.sourceId))
      const requiredSources = sources.filter((source) => requiredIds.has(source.id))
      const workerSources: Array<{ id: string; buffer: ArrayBuffer }> = []
      for (let index = 0; index < requiredSources.length; index++) {
        if (exportCancelledRef.current) throw new Error("cancelled")
        workerSources.push({ id: requiredSources[index].id, buffer: await requiredSources[index].file.arrayBuffer() })
        setProgress(Math.max(2, Math.round(((index + 1) / Math.max(1, requiredSources.length)) * 15)))
      }
      const watermarkBytes = addWatermark ? await renderWatermarkText(watermarkText.trim()) : undefined
      const requestId = crypto.randomUUID()
      setProgressText(pick("正在浏览器后台重建 PDF", "Rebuilding the PDF in the background"))

      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exportRejectRef.current = reject
        worker.onmessage = (event: MessageEvent<ExportMessage>) => {
          const message = event.data
          if (message.requestId !== requestId) return
          if (message.type === "progress") {
            const ratio = (message.completed ?? 0) / Math.max(1, message.total ?? 1)
            setProgress(15 + Math.round(ratio * 82))
          }
          if (message.type === "result" && message.buffer) resolve(message.buffer)
          if (message.type === "error") reject(new Error(`${message.code ?? "export-failed"}:${message.error ?? ""}`))
        }
        worker.onerror = () => reject(new Error("worker-failed"))
        const transfer: Transferable[] = workerSources.map((source) => source.buffer)
        if (watermarkBytes) transfer.push(watermarkBytes.buffer as ArrayBuffer)
        worker.postMessage({
          type: "export",
          requestId,
          sources: workerSources,
          pages,
          options: {
            pageNumbers: addPageNumbers,
            pageNumberStart,
            watermark: watermarkBytes ? { pngBytes: watermarkBytes, opacity: watermarkOpacity / 100 } : null,
            clearMetadata: metadataMode === "clear",
            metadata: metadataMode === "custom" ? {
              title: documentTitle,
              author: documentAuthor,
              subject: documentSubject,
              keywords: documentKeywords.split(/[,，]/).map((keyword) => keyword.trim()).filter(Boolean),
            } : null,
          },
        }, transfer)
      })

      const firstSource = sourceById.get(pages[0].sourceId)
      const prefix = sources.length > 1 ? "tabnative-merged" : baseName(firstSource?.file.name ?? "tabnative-pdf")
      setProgressText(pick("正在校验导出文件", "Verifying the exported file"))
      const { PDFDocument } = await import("pdf-lib")
      const verified = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false })
      if (verified.getPageCount() !== pages.length) throw new Error("verification:page-count")
      const generatedProperties = [verified.getCreator(), verified.getProducer()]
      const generatedDates = [verified.getCreationDate(), verified.getModificationDate()]
      if (generatedProperties.some((value) => value) || generatedDates.some((value) => value && value.getTime() !== 0)) {
        throw new Error("verification:generated-metadata")
      }
      if (metadataMode === "clear") {
        if ([verified.getTitle(), verified.getAuthor(), verified.getSubject(), verified.getKeywords()].some((value) => value)) {
          throw new Error("verification:metadata")
        }
      } else {
        const expectedKeywords = documentKeywords.split(/[,，]/).map((keyword) => keyword.trim()).filter(Boolean)
        if (
          (verified.getTitle() ?? "") !== documentTitle.trim()
          || (verified.getAuthor() ?? "") !== documentAuthor.trim()
          || (verified.getSubject() ?? "") !== documentSubject.trim()
          || expectedKeywords.some((keyword) => !verified.getKeywords()?.includes(keyword))
        ) throw new Error("verification:custom-metadata")
      }
      const defaultName = `${prefix}${selectedOnly ? "-selected" : "-organized"}.pdf`
      const requestedName = sanitizePdfFileName(outputName, defaultName)
      const filename = selectedOnly ? `${baseName(requestedName)}-selected.pdf` : requestedName
      const blob = new Blob([buffer], { type: "application/pdf" })
      const sourceNames = sources.filter((source) => new Set(pages.map((page) => page.sourceId)).has(source.id)).map((source) => source.file.name)
      setDelivery({ blob, filename, pages: pages.length, bytes: blob.size, selectedOnly, metadataMode, sourceNames })
      downloadBlob(blob, filename)
      setProgress(100)
      setProgressText(pick("PDF 已生成并通过页数与文档属性校验", "PDF created and verified for page count and document properties"))
    } catch (reason) {
      if (reason instanceof Error && reason.message !== "cancelled") setError(exportErrorText(reason, pick))
    } finally {
      worker.terminate()
      if (exportWorkerRef.current === worker) exportWorkerRef.current = null
      exportRejectRef.current = null
      setRunning(false)
    }
  }

  function cancelExport() {
    exportCancelledRef.current = true
    exportWorkerRef.current?.terminate()
    exportWorkerRef.current = null
    exportRejectRef.current?.(new Error("cancelled"))
    exportRejectRef.current = null
    setProgress(0)
    setProgressText(pick("已取消当前导出。", "The current export was cancelled."))
  }

  function downloadDeliveryReport() {
    if (!delivery) return
    const report = {
      product: "TabNative",
      filename: delivery.filename,
      generatedAt: new Date().toISOString(),
      sources: delivery.sourceNames,
      output: {
        pages: delivery.pages,
        bytes: delivery.bytes,
        selectedPagesOnly: delivery.selectedOnly,
        pageNumbers: addPageNumbers,
        watermark: addWatermark,
        documentProperties: delivery.metadataMode === "clear" ? "common-fields-cleared" : "custom-fields-written",
      },
      verification: { pageCount: "passed", documentProperties: "passed" },
      privacy: "Generated locally; this report contains filenames and settings, not file contents.",
    }
    downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), `${baseName(delivery.filename)}-report.json`)
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers3 className="size-5 text-cyan-500" />{pick("PDF 页面工作台", "PDF page workspace")}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{pick("添加一个或多个 PDF，在同一页面网格中完成合并、排序、旋转、删除和提取。", "Add one or more PDFs, then merge, reorder, rotate, remove, or extract pages in one workspace.")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          disabled={adding || running}
          aria-busy={adding}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDraggingFiles(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDraggingFiles(false)}
          onDrop={(event) => { event.preventDefault(); setDraggingFiles(false); void addFiles(Array.from(event.dataTransfer.files)) }}
          className={`flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition ${draggingFiles ? "border-cyan-500 bg-cyan-500/10" : "border-border bg-muted/20 hover:border-cyan-500/50 hover:bg-muted/35"}`}
        >
          {adding ? <LoaderCircle className="size-8 animate-spin text-cyan-500" /> : <FilePlus2 className="size-8 text-cyan-500" />}
          <span className="mt-3 text-sm font-semibold text-foreground">{adding ? pick("正在检查 PDF", "Checking PDFs") : pick("拖入 PDF，或点击选择", "Drop PDFs here, or click to choose")}</span>
          <span className="mt-1 text-xs text-muted-foreground">{pick("单个最大 150 MB · 合计最大 300 MB · 最多 20 个文件 / 1000 页", "150 MB each · 300 MB total · up to 20 files / 1,000 pages")}</span>
        </button>
        <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = "" }} />
        {notice ? <p role="status" aria-live="polite" className="text-sm text-cyan-700 dark:text-cyan-200">{notice}</p> : null}
        {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("无法完成操作", "Unable to complete the action")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>

    {sources.length ? <Card>
      <CardHeader>
        <CardTitle>{pick("来源文件", "Source files")}</CardTitle>
        <p className="text-sm text-muted-foreground">{format("{files} 个 PDF · 原始共 {pages} 页 · {size}", "{files} PDFs · {pages} source pages · {size}", { files: sources.length, pages: totalSourcePages, size: formatBytes(sources.reduce((sum, source) => sum + source.file.size, 0)) })}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((source, index) => {
          const hidden = collapsedSources.has(source.id)
          return <div key={source.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/15 p-3">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.color }} />
            <div className="min-w-40 flex-1"><p className="truncate text-sm font-semibold">{source.file.name}</p><p className="text-xs text-muted-foreground">{source.pages} {pick("页", "pages")} · {formatBytes(source.file.size)}</p></div>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set(pagePlan.filter((page) => page.sourceId === source.id).map((page) => page.id)))}><CheckSquare2 />{pick("选择页面", "Select pages")}</Button>
            <Button size="icon-sm" variant="outline" disabled={index === 0} onClick={() => moveSource(index, -1)} aria-label={pick("来源文件上移", "Move source up")}><ArrowUp /></Button>
            <Button size="icon-sm" variant="outline" disabled={index === sources.length - 1} onClick={() => moveSource(index, 1)} aria-label={pick("来源文件下移", "Move source down")}><ArrowDown /></Button>
            <Button size="icon-sm" variant="outline" onClick={() => setCollapsedSources((current) => toggleSetValue(current, source.id))} aria-label={hidden ? pick("显示来源页面", "Show source pages") : pick("隐藏来源页面", "Hide source pages")}>{hidden ? <Eye /> : <EyeOff />}</Button>
            <Button size="icon-sm" variant="destructive" onClick={() => removeSource(source)} aria-label={pick("移除来源文件", "Remove source file")}><X /></Button>
          </div>
        })}
      </CardContent>
    </Card> : null}

    {pagePlan.length ? <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>{pick("页面顺序", "Page order")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{format("保留 {kept} / {total} 页 · 已选择 {selected} 页", "{kept} / {total} pages kept · {selected} selected", { kept: pagePlan.length, total: totalSourcePages, selected: selectedIds.size })}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!canUndo || running} onClick={undo}><Undo2 />{pick("撤销", "Undo")}</Button>
            <Button size="sm" variant="outline" disabled={!canRedo || running} onClick={redo}><Redo2 />{pick("重做", "Redo")}</Button>
            <Button size="sm" variant="outline" disabled={running} onClick={resetWorkspace}><RotateCcw />{pick("恢复原始顺序", "Reset order")}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set(pagePlan.map((page) => page.id)))}>{pick("全选", "Select all")}</Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => setSelectedIds(new Set())}>{pick("取消选择", "Clear selection")}</Button>
          <Button size="icon-sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => movePdfWorkspaceSelection(current, selectedIds, -1))} aria-label={pick("所选页面前移", "Move selected pages earlier")}><ArrowLeft /></Button>
          <Button size="icon-sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => movePdfWorkspaceSelection(current, selectedIds, 1))} aria-label={pick("所选页面后移", "Move selected pages later")}><ArrowRight /></Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => rotatePdfWorkspacePages(current, selectedIds, -90))}><RotateCcw />{pick("向左旋转", "Rotate left")}</Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => rotatePdfWorkspacePages(current, selectedIds, 90))}><RotateCw />{pick("向右旋转", "Rotate right")}</Button>
          <Button size="sm" variant="destructive" disabled={!selectedIds.size} onClick={removeSelectedPages}><Trash2 />{pick("删除所选页", "Remove selected")}</Button>
        </div>

        {visiblePages.length ? <div role="listbox" aria-multiselectable="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visiblePages.map((page) => {
            const source = sourceById.get(page.sourceId)
            const selected = selectedIds.has(page.id)
            const outputIndex = pagePlan.findIndex((candidate) => candidate.id === page.id)
            return <article
              key={page.id}
              role="option"
              draggable={!running}
              aria-selected={selected}
              onClick={(event) => selectPage(page.id, event)}
              onDragStart={(event) => startPageDrag(page.id, event)}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move" }}
              onDrop={(event) => dropPages(page.id, event)}
              className={`group relative cursor-pointer overflow-hidden rounded-xl border p-2 transition ${selected ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/20" : "border-border bg-muted/10 hover:border-cyan-500/50"}`}
              style={{ contentVisibility: "auto", containIntrinsicSize: "240px 340px" }}
            >
              <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white"><GripVertical className="size-3" />{outputIndex + 1}</div>
              <LazyPdfThumbnail sourceId={page.sourceId} pageIndex={page.sourcePageIndex} rotation={page.rotation} requestThumbnail={preview.requestThumbnail} />
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: source?.color ?? "#71717a" }} />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{source?.file.name ?? pick("未知来源", "Unknown source")}</p><p className="text-[11px] text-muted-foreground">{format("原始第 {page} 页", "Source page {page}", { page: page.sourcePageIndex + 1 })}{page.rotation ? ` · ${page.rotation}°` : ""}</p></div>
              </div>
            </article>
          })}
        </div> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{pick("所有来源页面都已隐藏，可在来源文件区域重新显示。", "All source pages are hidden. Show them again from Source files.")}</div>}
        <p className="text-xs leading-5 text-muted-foreground">{pick("缩略图只在进入可视区域时由后台 Worker 生成；Ctrl/Cmd 可多选，Shift 可连续选择，也可以拖动所选页面。", "Thumbnails are generated by a background Worker only when visible. Use Ctrl/Cmd for multi-select, Shift for a range, or drag selected pages.")}</p>
      </CardContent>
    </Card> : null}

    {pagePlan.length ? <Card>
      <CardHeader><CardTitle>{pick("导出设置", "Export settings")}</CardTitle><p className="text-sm text-muted-foreground">{format("将从 {files} 个来源生成 {pages} 页 PDF；已从原始文档中移除 {removed} 页。", "The output uses {files} sources and {pages} pages; {removed} source pages are removed.", { files: new Set(pagePlan.map((page) => page.sourceId)).size, pages: pagePlan.length, removed: totalSourcePages - pagePlan.length })}</p></CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-500/30 bg-amber-500/[.06] text-amber-950 dark:text-amber-100"><AlertTriangle /><AlertTitle>{pick("导出会重建 PDF", "Export rebuilds the PDF")}</AlertTitle><AlertDescription>{pick("数字签名通常会失效；交互表单、书签、附件等文档级结构可能无法保留。请保留原文件并检查导出结果。", "Digital signatures usually become invalid. Forms, bookmarks, attachments, and other document-level structures may not be preserved. Keep the originals and verify the output.")}</AlertDescription></Alert>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm"><span className="font-semibold">{pick("输出文件名", "Output filename")}</span><Input value={outputName} maxLength={120} onChange={(event) => setOutputName(event.target.value)} /><span className="block text-xs leading-5 text-muted-foreground">{pick("提取所选页面时会自动追加 selected。", "Selected-page exports automatically add selected to the name.")}</span></label>
          <fieldset className="rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">{pick("文档属性", "Document properties")}</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${metadataMode === "clear" ? "border-cyan-500 bg-cyan-500/10" : "border-border"}`}><input type="radio" name="pdf-metadata-mode" checked={metadataMode === "clear"} onChange={() => setMetadataMode("clear")} className="mt-1 accent-cyan-500" /><span><span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-cyan-500" />{pick("清理常见属性", "Clear common properties")}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{pick("不复制来源标题、作者、主题、关键词和导出时间。", "Do not copy source title, author, subject, keywords, or local export time.")}</span></span></label>
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${metadataMode === "custom" ? "border-cyan-500 bg-cyan-500/10" : "border-border"}`}><input type="radio" name="pdf-metadata-mode" checked={metadataMode === "custom"} onChange={() => setMetadataMode("custom")} className="mt-1 accent-cyan-500" /><span><span className="text-sm font-semibold">{pick("写入自定义属性", "Write custom properties")}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{pick("只写入你在下方确认的字段。", "Write only the fields you confirm below.")}</span></span></label>
            </div>
          </fieldset>
        </div>
        {metadataMode === "custom" ? <div className="grid gap-3 rounded-xl border border-border bg-muted/10 p-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm"><span>{pick("标题", "Title")}</span><Input value={documentTitle} maxLength={180} onChange={(event) => setDocumentTitle(event.target.value)} /></label>
          <label className="space-y-2 text-sm"><span>{pick("作者", "Author")}</span><Input value={documentAuthor} maxLength={180} onChange={(event) => setDocumentAuthor(event.target.value)} /></label>
          <label className="space-y-2 text-sm"><span>{pick("主题", "Subject")}</span><Input value={documentSubject} maxLength={240} onChange={(event) => setDocumentSubject(event.target.value)} /></label>
          <label className="space-y-2 text-sm"><span>{pick("关键词（逗号分隔）", "Keywords (comma-separated)")}</span><Input value={documentKeywords} maxLength={300} onChange={(event) => setDocumentKeywords(event.target.value)} /></label>
        </div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <label className="flex items-start gap-3"><input type="checkbox" checked={addPageNumbers} onChange={(event) => setAddPageNumbers(event.target.checked)} className="mt-1 size-4 accent-cyan-500" /><span><span className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4 text-cyan-500" />{pick("添加页码", "Add page numbers")}</span><span className="mt-1 block text-xs text-muted-foreground">{pick("页码显示在每页底部中央。", "Page numbers appear at the bottom center.")}</span></span></label>
            {addPageNumbers ? <label className="mt-3 block text-xs text-muted-foreground"><span>{pick("起始页码", "Starting number")}</span><Input type="number" min={1} max={999999} value={pageNumberStart} onChange={(event) => setPageNumberStart(Math.max(1, Number(event.target.value) || 1))} className="mt-2" /></label> : null}
          </div>
          <div className="rounded-xl border border-border p-4">
            <label className="flex items-start gap-3"><input type="checkbox" checked={addWatermark} onChange={(event) => setAddWatermark(event.target.checked)} className="mt-1 size-4 accent-cyan-500" /><span><span className="flex items-center gap-2 text-sm font-semibold"><Stamp className="size-4 text-cyan-500" />{pick("添加文字水印", "Add text watermark")}</span><span className="mt-1 block text-xs text-muted-foreground">{pick("水印在本地渲染并应用到导出页面。", "The watermark is rendered locally and applied to exported pages.")}</span></span></label>
            {addWatermark ? <div className="mt-3 space-y-3"><Input value={watermarkText} maxLength={80} placeholder={pick("例如：内部资料", "For example: Internal")} onChange={(event) => setWatermarkText(event.target.value)} /><label className="block text-xs text-muted-foreground"><span>{pick("不透明度", "Opacity")} · {watermarkOpacity}%</span><input type="range" min={5} max={60} value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.target.value))} className="mt-2 w-full accent-cyan-500" /></label></div> : null}
          </div>
        </div>
        {running || progress ? <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[.06] p-4"><div className="flex items-center justify-between gap-3 text-sm"><span>{progressText}</span><span>{progress}%</span></div><Progress value={progress} />{running ? <Button size="sm" variant="outline" onClick={cancelExport}><X />{pick("取消导出", "Cancel export")}</Button> : null}</div> : null}
        {delivery ? <Alert className="border-emerald-500/30 bg-emerald-500/[.07] text-emerald-950 dark:text-emerald-100"><FileCheck2 /><AlertTitle>{pick("交付文件已校验", "Delivery file verified")}</AlertTitle><AlertDescription><p>{format("{name} · {pages} 页 · {size}", "{name} · {pages} pages · {size}", { name: delivery.filename, pages: delivery.pages, size: formatBytes(delivery.bytes) })}</p><p className="mt-1 text-xs opacity-80">{pick("已核对页数和文档属性设置；请仍人工检查表单、链接和版面。", "Page count and document-property settings were checked; still review forms, links, and layout manually.")}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => downloadBlob(delivery.blob, delivery.filename)}><Download />{pick("再次下载", "Download again")}</Button><Button size="sm" variant="outline" onClick={downloadDeliveryReport}><Download />{pick("下载交付报告", "Download delivery report")}</Button></div></AlertDescription></Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={running} onClick={() => void exportPages(pagePlan, false)}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{format("导出完整 PDF（{count} 页）", "Export complete PDF ({count} pages)", { count: pagePlan.length })}</Button>
          <Button variant="outline" disabled={running || !selectedPages.length} onClick={() => void exportPages(selectedPages, true)}><Download />{format("提取所选页面（{count} 页）", "Extract selected pages ({count})", { count: selectedPages.length })}</Button>
        </div>
      </CardContent>
    </Card> : null}
  </div>
}

function LazyPdfThumbnail({
  sourceId,
  pageIndex,
  rotation,
  requestThumbnail,
}: {
  sourceId: string
  pageIndex: number
  rotation: number
  requestThumbnail: (sourceId: string, pageIndex: number, targetWidth?: number, rotation?: number) => Promise<Blob>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState("")
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element || visible) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: "320px" })
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let objectUrl = ""
    void requestThumbnail(sourceId, pageIndex, 220, rotation).then((blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [pageIndex, requestThumbnail, rotation, sourceId, visible])

  return <div ref={containerRef} className="flex aspect-[.72] items-center justify-center overflow-hidden rounded-lg bg-white p-2">
    {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : failed ? <span className="px-2 text-center text-xs text-zinc-500">{pageIndex + 1}</span> : <LoaderCircle className="size-5 animate-spin text-zinc-400" />}
  </div>
}

function usePdfPreviewWorker() {
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef(new Map<string, PreviewPending>())

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL("../workers/pdf-preview.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<PreviewMessage>) => {
      const message = event.data
      const pending = pendingRef.current.get(message.requestId)
      if (!pending) return
      pendingRef.current.delete(message.requestId)
      if (message.type === "source-loaded" && typeof message.pages === "number") pending.resolve(message.pages)
      else if (message.type === "thumbnail" && message.blob) pending.resolve(message.blob)
      else pending.reject(new Error(`${message.code ?? "pdf-load-failed"}:${message.error ?? ""}`))
    }
    worker.onerror = () => {
      for (const pending of pendingRef.current.values()) pending.reject(new Error("worker-failed"))
      pendingRef.current.clear()
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }
    workerRef.current = worker
    return worker
  }, [])

  useEffect(() => () => {
    workerRef.current?.terminate()
    workerRef.current = null
    for (const pending of pendingRef.current.values()) pending.reject(new Error("worker-terminated"))
    pendingRef.current.clear()
  }, [])

  const loadSource = useCallback((sourceId: string, buffer: ArrayBuffer) => {
    const worker = ensureWorker()
    const requestId = crypto.randomUUID()
    return new Promise<number>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve: (value) => resolve(value as number), reject })
      worker.postMessage({ type: "load-source", requestId, sourceId, buffer }, [buffer])
    })
  }, [ensureWorker])

  const requestThumbnail = useCallback((sourceId: string, pageIndex: number, targetWidth = 220, rotation = 0) => {
    const worker = ensureWorker()
    const requestId = crypto.randomUUID()
    return new Promise<Blob>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve: (value) => resolve(value as Blob), reject })
      worker.postMessage({ type: "thumbnail", requestId, sourceId, pageIndex, targetWidth, rotation })
    })
  }, [ensureWorker])

  const releaseSource = useCallback((sourceId: string) => {
    workerRef.current?.postMessage({ type: "release-source", sourceId })
  }, [])

  return { loadSource, requestThumbnail, releaseSource }
}

async function renderWatermarkText(text: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 1600
  canvas.height = 600
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is unavailable")
  const fontSize = Math.max(54, Math.min(116, 1150 / Math.sqrt(Math.max(1, text.length))))
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

function previewErrorText(reason: unknown, pick: (zh: string, en: string) => string) {
  const message = reason instanceof Error ? reason.message : ""
  if (message.startsWith("encrypted:")) return pick("PDF 已加密或需要密码，暂时无法编辑。", "This PDF is encrypted or password-protected and cannot be edited.")
  if (message.startsWith("invalid-pdf:")) return pick("文件结构无效或已经损坏。", "The file structure is invalid or damaged.")
  return pick("无法在浏览器中读取该 PDF。", "The browser could not read this PDF.")
}

function exportErrorText(reason: Error, pick: (zh: string, en: string) => string) {
  if (reason.message.startsWith("verification:")) return pick("导出文件未通过本地校验，请重新添加来源文件后再试。", "The exported file did not pass local verification. Add the source files again and retry.")
  if (reason.message.startsWith("encrypted:")) return pick("至少一个 PDF 已加密，无法重建。", "At least one PDF is encrypted and cannot be rebuilt.")
  if (reason.message.startsWith("memory:")) return pick("浏览器内存不足，请减少文件或页面后重试。", "The browser ran out of memory. Retry with fewer files or pages.")
  if (reason.message.startsWith("invalid-pdf:")) return pick("页面计划或源 PDF 无效，请重新添加文件。", "The page plan or a source PDF is invalid. Add the files again.")
  return pick("PDF 导出失败，请减少文件大小后重试。", "PDF export failed. Retry with smaller files.")
}

function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function toggleSetValue(current: ReadonlySet<string>, value: string) {
  const next = new Set(current)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function plansEqual(left: readonly PdfWorkspacePage[], right: readonly PdfWorkspacePage[]) {
  return left.length === right.length && left.every((page, index) => {
    const other = right[index]
    return page.id === other.id && page.rotation === other.rotation && page.sourceId === other.sourceId && page.sourcePageIndex === other.sourcePageIndex
  })
}
