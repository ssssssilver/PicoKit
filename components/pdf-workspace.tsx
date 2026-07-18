"use client"

/* eslint-disable @next/next/no-img-element -- PDF thumbnails are generated locally as blob URLs. */

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckSquare2,
  Crop,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FilePlus2,
  FolderOpen,
  GripVertical,
  Hash,
  Layers3,
  LoaderCircle,
  Maximize2,
  Package,
  Redo2,
  RotateCcw,
  RotateCw,
  Stamp,
  ShieldCheck,
  Save,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { baseName, canvasToBlob, downloadBlob, formatBytes } from "@/lib/browser-files"
import {
  canRasterCompressPdf,
  PDF_RASTER_COMPRESSION_MAX_PAGES,
  type PdfCompressionMode,
} from "@/lib/pdf-compression"
import {
  parsePdfSplitSpec,
  sanitizePdfFileName,
  type PdfTargetOrientation,
  type PdfTargetPageSize,
} from "@/lib/pdf-conversion"
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
import {
  clearPdfWorkspaceDraft,
  getPdfWorkspaceDraftMeta,
  loadPdfWorkspaceDraft,
  savePdfWorkspaceDraft,
} from "@/lib/pdf-workspace-draft"

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
  type: "progress" | "result" | "split-result" | "error"
  requestId: string
  completed?: number
  total?: number
  buffer?: ArrayBuffer
  code?: string
  error?: string
  results?: Array<{ label: string; buffer: ArrayBuffer }>
}
type DeliveryResult = {
  blob: Blob
  filename: string
  pages: number
  bytes: number
  selectedOnly: boolean
  metadataMode: "clear" | "custom"
  sourceNames: string[]
  compressionMode: PdfCompressionMode
}

const sourceColors = ["#22d3ee", "#a78bfa", "#fb7185", "#fbbf24", "#34d399", "#60a5fa", "#f97316", "#c084fc"]
const historyLimit = 50

export function PdfWorkspace({
  incomingPdf,
  onContinueToImages,
}: {
  incomingPdf?: { id: string; file: File } | null
  onContinueToImages?: (file: File) => void
}) {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const pagePlanRef = useRef<PdfWorkspacePage[]>([])
  const historyRef = useRef<HistoryState>({ past: [], future: [] })
  const draggedIdsRef = useRef<Set<string>>(new Set())
  const selectionAnchorRef = useRef("")
  const exportWorkerRef = useRef<Worker | null>(null)
  const exportRejectRef = useRef<((reason: Error) => void) | null>(null)
  const exportCancelledRef = useRef(false)
  const importCancelledRef = useRef(false)
  const incomingRef = useRef("")
  const addFilesRef = useRef<(files: readonly File[]) => Promise<void>>(async () => undefined)
  const preview = usePdfPreviewWorker()

  const [sources, setSources] = useState<WorkspaceSource[]>([])
  const [pagePlan, setPagePlan] = useState<PdfWorkspacePage[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; name: string } | null>(null)
  const [deviceMemory] = useState<number | null>(() => {
    if (typeof navigator === "undefined") return null
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    return typeof memory === "number" ? memory : null
  })
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
  const [normalizePages, setNormalizePages] = useState(false)
  const [cropMargin, setCropMargin] = useState(0)
  const [targetPageSize, setTargetPageSize] = useState<PdfTargetPageSize>("a4")
  const [targetOrientation, setTargetOrientation] = useState<PdfTargetOrientation>("auto")
  const [targetMargin, setTargetMargin] = useState(18)
  const [splitSpec, setSplitSpec] = useState("")
  const [compressionMode, setCompressionMode] = useState<PdfCompressionMode>("structure")
  const [draftAvailable, setDraftAvailable] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [previewPageId, setPreviewPageId] = useState("")
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null)

  useEffect(() => () => {
    exportWorkerRef.current?.terminate()
    exportWorkerRef.current = null
  }, [])

  useEffect(() => {
    let active = true
    void getPdfWorkspaceDraftMeta().then((meta) => {
      if (active) setDraftAvailable(Boolean(meta))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])
  const visiblePages = useMemo(() => pagePlan.filter((page) => !collapsedSources.has(page.sourceId)), [collapsedSources, pagePlan])
  const totalSourcePages = useMemo(() => sources.reduce((sum, source) => sum + source.pages, 0), [sources])
  const totalSourceBytes = useMemo(() => sources.reduce((sum, source) => sum + source.file.size, 0), [sources])
  const memoryWarning = totalSourcePages >= 500 || totalSourceBytes >= Math.min(220 * 1024 * 1024, (deviceMemory ?? 4) * 64 * 1024 * 1024)
  const selectedPages = useMemo(() => pagePlan.filter((page) => selectedIds.has(page.id)), [pagePlan, selectedIds])
  const splitGroups = useMemo(() => parsePdfSplitSpec(splitSpec, pagePlan.length), [pagePlan.length, splitSpec])
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
    setImportProgress({ current: 0, total: files.length, name: "" })
    importCancelledRef.current = false
    const accepted: WorkspaceSource[] = []
    const rejected: string[] = []
    const known = new Set(sources.map((source) => fileFingerprint(source.file)))
    let totalBytes = sources.reduce((sum, source) => sum + source.file.size, 0)
    let totalPages = sources.reduce((sum, source) => sum + source.pages, 0)

    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        if (importCancelledRef.current) break
        const file = files[fileIndex]
        setImportProgress({ current: fileIndex + 1, total: files.length, name: file.name })
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
          if (importCancelledRef.current) {
            preview.releaseSource(id)
            break
          }
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
        setNotice(importCancelledRef.current ? pick("已取消继续添加文件。", "Stopped adding more files.") : "")
      }
      setError(rejected.slice(0, 4).join("；"))
    } finally {
      setAdding(false)
      setImportProgress(null)
    }
  }
  useEffect(() => {
    addFilesRef.current = addFiles
  })

  useEffect(() => {
    if (!incomingPdf || incomingRef.current === incomingPdf.id) return
    incomingRef.current = incomingPdf.id
    void addFilesRef.current([incomingPdf.file])
  }, [incomingPdf])

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
    setPreviewPageId(pageId)
  }

  function closePagePreview() {
    const pageId = previewPageId
    setPreviewPageId("")
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-pdf-page-id="${CSS.escape(pageId)}"]`)?.focus())
  }

  function rotatePreviewPage(pageId: string, degrees: -90 | 90) {
    commitPlan((current) => rotatePdfWorkspacePages(current, new Set([pageId]), degrees))
  }

  function movePreviewPage(pageId: string, direction: -1 | 1) {
    commitPlan((current) => movePdfWorkspaceSelection(current, new Set([pageId]), direction))
  }

  function togglePreviewPageSelection(pageId: string) {
    setSelectedIds((current) => toggleSetValue(current, pageId))
  }

  function removePreviewPage(pageId: string) {
    const current = pagePlanRef.current
    const index = current.findIndex((page) => page.id === pageId)
    if (index < 0) return
    if (current.length <= 1) {
      setError(pick("PDF 至少需要保留一页。", "Keep at least one page in the PDF."))
      return
    }
    const nextActiveId = current[index + 1]?.id ?? current[index - 1]?.id ?? ""
    commitPlan((plan) => deletePdfWorkspacePages(plan, new Set([pageId])))
    setSelectedIds((selected) => {
      const next = new Set(selected)
      next.delete(pageId)
      return next
    })
    setPreviewPageId(nextActiveId)
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

  async function saveDraft() {
    if (!sources.length || draftBusy) return
    setDraftBusy(true)
    setError("")
    try {
      await savePdfWorkspaceDraft({
        sources: sources.map((source) => ({
          id: source.id,
          blob: source.file,
          name: source.file.name,
          type: source.file.type,
          lastModified: source.file.lastModified,
          pages: source.pages,
          color: source.color,
        })),
        pagePlan,
        settings: {
          outputName,
          metadataMode,
          documentTitle,
          documentAuthor,
          documentSubject,
          documentKeywords,
          addPageNumbers,
          pageNumberStart,
          addWatermark,
          watermarkText,
          watermarkOpacity,
          normalizePages,
          cropMargin,
          targetPageSize,
          targetOrientation,
          targetMargin,
          splitSpec,
          compressionMode,
        },
      })
      setDraftAvailable(true)
      setNotice(pick("本地草稿已保存 7 天；可随时覆盖或清除。", "Local draft saved for 7 days; you can overwrite or clear it at any time."))
    } catch {
      setError(pick("无法保存本地草稿。浏览器存储空间可能不足。", "Unable to save the local draft. Browser storage may be full."))
    } finally {
      setDraftBusy(false)
    }
  }

  async function restoreDraft() {
    if (!draftAvailable || draftBusy || adding || running) return
    setDraftBusy(true)
    setAdding(true)
    setError("")
    setNotice(pick("正在恢复本地草稿…", "Restoring the local draft…"))
    const loadedSourceIds: string[] = []
    try {
      const draft = await loadPdfWorkspaceDraft()
      if (!draft) {
        setDraftAvailable(false)
        throw new Error("missing-draft")
      }
      for (const source of sources) preview.releaseSource(source.id)
      setSources([])
      replacePlanAfterSourceChange([])
      const restoredSources: WorkspaceSource[] = []
      for (const source of draft.sources) {
        const file = new File([source.blob], source.name, { type: source.type || "application/pdf", lastModified: source.lastModified })
        const pages = await preview.loadSource(source.id, await file.arrayBuffer())
        loadedSourceIds.push(source.id)
        restoredSources.push({ id: source.id, file, pages, color: source.color })
      }
      const validPages = new Map(restoredSources.map((source) => [source.id, source.pages]))
      const restoredPlan = draft.pagePlan.filter((page) => page.sourcePageIndex >= 0 && page.sourcePageIndex < (validPages.get(page.sourceId) ?? 0))
      const finalPlan = restoredPlan.length ? restoredPlan : restoredSources.flatMap((source) => createPdfWorkspacePages(source.id, source.pages))
      setSources(restoredSources)
      replacePlanAfterSourceChange(finalPlan)
      setCollapsedSources(new Set())
      setOutputName(draft.settings.outputName)
      setMetadataMode(draft.settings.metadataMode)
      setDocumentTitle(draft.settings.documentTitle)
      setDocumentAuthor(draft.settings.documentAuthor)
      setDocumentSubject(draft.settings.documentSubject)
      setDocumentKeywords(draft.settings.documentKeywords)
      setAddPageNumbers(draft.settings.addPageNumbers)
      setPageNumberStart(draft.settings.pageNumberStart)
      setAddWatermark(draft.settings.addWatermark)
      setWatermarkText(draft.settings.watermarkText)
      setWatermarkOpacity(draft.settings.watermarkOpacity)
      setNormalizePages(draft.settings.normalizePages)
      setCropMargin(draft.settings.cropMargin)
      setTargetPageSize(draft.settings.targetPageSize)
      setTargetOrientation(draft.settings.targetOrientation)
      setTargetMargin(draft.settings.targetMargin)
      setSplitSpec(draft.settings.splitSpec)
      setCompressionMode(draft.settings.compressionMode ?? "structure")
      setNotice(format("已恢复 {files} 个 PDF、{pages} 页及导出设置。", "Restored {files} PDFs, {pages} pages, and export settings.", { files: restoredSources.length, pages: finalPlan.length }))
    } catch (reason) {
      for (const sourceId of loadedSourceIds) preview.releaseSource(sourceId)
      setError(reason instanceof Error && reason.message === "missing-draft"
        ? pick("本地草稿已过期或已被浏览器清理。", "The local draft expired or was cleared by the browser.")
        : pick("无法恢复本地草稿。草稿可能不完整，请重新添加 PDF。", "Unable to restore the local draft. It may be incomplete; add the PDFs again."))
    } finally {
      setAdding(false)
      setDraftBusy(false)
    }
  }

  async function clearDraft() {
    if (draftBusy) return
    setDraftBusy(true)
    try {
      await clearPdfWorkspaceDraft()
      setDraftAvailable(false)
      setNotice(pick("本地草稿已清除。", "Local draft cleared."))
    } catch {
      setError(pick("无法清除本地草稿，请检查浏览器存储权限。", "Unable to clear the local draft. Check browser storage permissions."))
    } finally {
      setDraftBusy(false)
    }
  }

  async function exportPages(pages: PdfWorkspacePage[], selectedOnly: boolean) {
    if (!pages.length || running) return
    if (compressionMode !== "structure" && !canRasterCompressPdf(pages.length)) {
      setError(format("栅格压缩一次最多处理 {count} 页；请提取较小范围或使用结构优化。", "Raster compression handles up to {count} pages at a time; extract a smaller range or use structural optimization.", { count: PDF_RASTER_COMPRESSION_MAX_PAGES }))
      return
    }
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
            pageNormalization: normalizePages ? {
              cropMargin,
              pageSize: targetPageSize,
              orientation: targetOrientation,
              margin: targetMargin,
            } : null,
            compressionMode,
          },
        }, transfer)
      })

      if (exportCancelledRef.current) throw new Error("cancelled")
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
      if (exportCancelledRef.current) throw new Error("cancelled")
      setDelivery({ blob, filename, pages: pages.length, bytes: blob.size, selectedOnly, metadataMode, sourceNames, compressionMode })
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

  async function exportSplitGroups() {
    if (running || !pagePlan.length) return
    if (!splitGroups.length) {
      setError(pick("请输入有效的拆分范围，例如 1-3；4-8；9-12。", "Enter valid split ranges, such as 1-3; 4-8; 9-12."))
      return
    }
    if (splitGroups.length > 50) {
      setError(pick("一次最多生成 50 个拆分文件。", "Create up to 50 split files at a time."))
      return
    }
    if (addWatermark && !watermarkText.trim()) {
      setError(pick("请输入水印文字，或关闭文字水印。", "Enter watermark text or turn off the text watermark."))
      return
    }

    setRunning(true)
    setError("")
    setDelivery(null)
    setProgress(1)
    setProgressText(pick("正在准备批量拆分", "Preparing batch split"))
    exportCancelledRef.current = false
    const worker = new Worker(new URL("../workers/pdf-export.worker.ts", import.meta.url), { type: "module" })
    exportWorkerRef.current = worker
    try {
      const groupedPages = splitGroups.map((group) => ({
        label: group.label,
        pages: group.pageIndexes.map((index) => pagePlan[index]).filter(Boolean),
      }))
      const totalSplitPages = groupedPages.reduce((sum, group) => sum + group.pages.length, 0)
      if (compressionMode !== "structure" && !canRasterCompressPdf(totalSplitPages)) {
        throw new Error(`raster-limit:${PDF_RASTER_COMPRESSION_MAX_PAGES}`)
      }
      const requiredIds = new Set(groupedPages.flatMap((group) => group.pages.map((page) => page.sourceId)))
      const requiredSources = sources.filter((source) => requiredIds.has(source.id))
      const workerSources: Array<{ id: string; buffer: ArrayBuffer }> = []
      for (let index = 0; index < requiredSources.length; index++) {
        if (exportCancelledRef.current) throw new Error("cancelled")
        workerSources.push({ id: requiredSources[index].id, buffer: await requiredSources[index].file.arrayBuffer() })
        setProgress(Math.max(2, Math.round(((index + 1) / Math.max(1, requiredSources.length)) * 12)))
      }
      const watermarkBytes = addWatermark ? await renderWatermarkText(watermarkText.trim()) : undefined
      const requestId = crypto.randomUUID()
      const results = await new Promise<Array<{ label: string; buffer: ArrayBuffer }>>((resolve, reject) => {
        exportRejectRef.current = reject
        worker.onmessage = (event: MessageEvent<ExportMessage>) => {
          const message = event.data
          if (message.requestId !== requestId) return
          if (message.type === "progress") {
            const ratio = (message.completed ?? 0) / Math.max(1, message.total ?? 1)
            setProgress(12 + Math.round(ratio * 72))
          }
          if (message.type === "split-result" && message.results) resolve(message.results)
          if (message.type === "error") reject(new Error(`${message.code ?? "export-failed"}:${message.error ?? ""}`))
        }
        worker.onerror = () => reject(new Error("worker-failed"))
        const transfer: Transferable[] = workerSources.map((source) => source.buffer)
        if (watermarkBytes) transfer.push(watermarkBytes.buffer as ArrayBuffer)
        worker.postMessage({
          type: "split-export",
          requestId,
          sources: workerSources,
          groups: groupedPages,
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
            pageNormalization: normalizePages ? {
              cropMargin,
              pageSize: targetPageSize,
              orientation: targetOrientation,
              margin: targetMargin,
            } : null,
            compressionMode,
          },
        }, transfer)
      })

      if (exportCancelledRef.current) throw new Error("cancelled")
      setProgressText(pick("正在校验并打包拆分文件", "Verifying and packaging split files"))
      const { PDFDocument } = await import("pdf-lib")
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      const prefix = baseName(sanitizePdfFileName(outputName, "tabnative-organized"))
      for (let index = 0; index < results.length; index++) {
        if (exportCancelledRef.current) throw new Error("cancelled")
        const verified = await PDFDocument.load(results[index].buffer, { ignoreEncryption: false, updateMetadata: false })
        if (verified.getPageCount() !== groupedPages[index].pages.length) throw new Error("verification:page-count")
        const rangeLabel = results[index].label.replace(/[^0-9,-]+/g, "-").replace(/^-+|-+$/g, "") || String(index + 1)
        zip.file(`${prefix}-${String(index + 1).padStart(2, "0")}-${rangeLabel}.pdf`, results[index].buffer)
      }
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (metadata) => setProgress(84 + Math.round(metadata.percent * 0.15)))
      if (exportCancelledRef.current) throw new Error("cancelled")
      downloadBlob(zipBlob, `${prefix}-split.zip`)
      setProgress(100)
      setProgressText(format("已生成并校验 {count} 个 PDF", "Created and verified {count} PDFs", { count: results.length }))
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
        compression: delivery.compressionMode,
      },
      verification: { pageCount: "passed", documentProperties: "passed" },
      privacy: "Generated locally; this report contains filenames and settings, not file contents.",
    }
    downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), `${baseName(delivery.filename)}-report.json`)
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers3 className="size-5 text-cyan-500" />{pick("PDF 页面装配区", "PDF page assembly")}</CardTitle>
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/10 p-3">
          <span className="mr-auto text-xs leading-5 text-muted-foreground">{pick("仅在你点击保存后，PDF 与当前设置才会写入此浏览器；草稿 7 天后失效。", "PDFs and settings are stored in this browser only after you choose Save; the draft expires after 7 days.")}</span>
          <Button size="sm" variant="outline" disabled={!sources.length || draftBusy || adding || running} onClick={() => void saveDraft()}>{draftBusy ? <LoaderCircle className="animate-spin" /> : <Save />}{pick("保存本地草稿", "Save local draft")}</Button>
          <Button size="sm" variant="outline" disabled={!draftAvailable || draftBusy || adding || running} onClick={() => void restoreDraft()}><FolderOpen />{pick("恢复草稿", "Restore draft")}</Button>
          {draftAvailable ? <Button size="sm" variant="ghost" disabled={draftBusy} onClick={() => void clearDraft()}><Trash2 />{pick("清除草稿", "Clear draft")}</Button> : null}
        </div>
        {adding && importProgress ? <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[.06] p-3 text-sm"><span className="min-w-0 truncate">{format("正在读取 {current}/{total}：{name}", "Reading {current}/{total}: {name}", importProgress)}</span><Button size="sm" variant="outline" onClick={() => { importCancelledRef.current = true; setNotice(pick("完成当前文件后停止。", "Stopping after the current file.")) }}><X />{pick("停止添加", "Stop adding")}</Button></div> : null}
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
        {memoryWarning ? <Alert className="mb-4 border-amber-500/30 bg-amber-500/[.06] text-amber-950 dark:text-amber-100"><AlertTriangle /><AlertTitle>{pick("大型工作区", "Large workspace")}</AlertTitle><AlertDescription>{pick("当前文件量可能占用较多内存。建议先处理最需要的页面，并关闭其他大型标签页；导入与导出都可取消。", "This workspace may use substantial memory. Keep only the pages you need and close other heavy tabs; both import and export can be cancelled.")}</AlertDescription></Alert> : null}
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
          <span aria-live="polite" className="mr-auto rounded-md bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-200">{selectedIds.size
            ? format("已选择 {count} 页", "{count} pages selected", { count: selectedIds.size })
            : pick("选择页面后可批量处理", "Select pages for batch actions")}</span>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set(pagePlan.map((page) => page.id)))}>{pick("全选", "Select all")}</Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => setSelectedIds(new Set())}>{pick("取消选择", "Clear selection")}</Button>
          <Button size="icon-sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => movePdfWorkspaceSelection(current, selectedIds, -1))} aria-label={pick("所选页面前移", "Move selected pages earlier")}><ArrowLeft /></Button>
          <Button size="icon-sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => movePdfWorkspaceSelection(current, selectedIds, 1))} aria-label={pick("所选页面后移", "Move selected pages later")}><ArrowRight /></Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => rotatePdfWorkspacePages(current, selectedIds, -90))}><RotateCcw />{pick("向左旋转", "Rotate left")}</Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => commitPlan((current) => rotatePdfWorkspacePages(current, selectedIds, 90))}><RotateCw />{pick("向右旋转", "Rotate right")}</Button>
          <Button size="sm" variant="destructive" disabled={!selectedIds.size} onClick={removeSelectedPages}><Trash2 />{pick("删除所选页", "Remove selected")}</Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById("pdf-export-settings")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Download />{pick("导出设置", "Export settings")}</Button>
        </div>

        {visiblePages.length ? <VirtualPdfPageGrid
          pages={visiblePages}
          pagePlan={pagePlan}
          sourceById={sourceById}
          selectedIds={selectedIds}
          running={running}
          onSelect={selectPage}
          onDragStart={startPageDrag}
          onDrop={dropPages}
          requestThumbnail={preview.requestThumbnail}
        /> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{pick("所有来源页面都已隐藏，可在来源文件区域重新显示。", "All source pages are hidden. Show them again from Source files.")}</div>}
        <p className="text-xs leading-5 text-muted-foreground">{pick("单击页面可查看大图并用方向键翻页；Ctrl/Cmd 可多选，Shift 可连续选择，也可以拖动所选页面。页面网格只挂载视口附近的项目，缩略图由后台 Worker 按需生成。", "Click a page for a large preview and use the arrow keys to navigate. Use Ctrl/Cmd for multi-select, Shift for a range, or drag selected pages. The grid mounts only items near the viewport and generates thumbnails on demand in a background Worker.")}</p>
      </CardContent>
    </Card> : null}

    {pagePlan.length ? <Card id="pdf-export-settings" className="scroll-mt-24">
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
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{pick("裁边与页面规范化", "Crop and page normalization")}</legend>
          <label className="mt-1 flex items-start gap-3"><input type="checkbox" checked={normalizePages} onChange={(event) => setNormalizePages(event.target.checked)} className="mt-1 size-4 accent-cyan-500" /><span><span className="flex items-center gap-2 text-sm font-semibold"><Crop className="size-4 text-cyan-500" />{pick("统一导出页面", "Normalize output pages")}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{pick("按统一纸张缩放并居中内容；文本与矢量内容保持为 PDF，不会栅格化。", "Scale and center content on consistent pages while keeping PDF text and vectors instead of rasterizing them.")}</span></span></label>
          {normalizePages ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PdfSelectField label={pick("统一纸张", "Target page size")} value={targetPageSize} onChange={(value) => setTargetPageSize(value as PdfTargetPageSize)} options={[["original", pick("按裁边后尺寸", "Cropped size")], ["a4", "A4"], ["letter", "Letter"]]} />
            <PdfSelectField label={pick("页面方向", "Orientation")} value={targetOrientation} onChange={(value) => setTargetOrientation(value as PdfTargetOrientation)} options={[["auto", pick("跟随内容", "Match content")], ["portrait", pick("纵向", "Portrait")], ["landscape", pick("横向", "Landscape")]]} />
            <label className="space-y-2 text-sm"><span>{pick("四边裁切", "Crop each edge")} · {cropMargin} pt</span><input type="range" min={0} max={72} step={3} value={cropMargin} onChange={(event) => setCropMargin(Number(event.target.value))} className="h-9 w-full accent-cyan-500" /></label>
            <label className="space-y-2 text-sm"><span>{pick("内容留白", "Content margin")} · {targetMargin} pt</span><input type="range" min={0} max={72} step={3} value={targetMargin} onChange={(event) => setTargetMargin(Number(event.target.value))} className="h-9 w-full accent-cyan-500" /></label>
          </div> : null}
        </fieldset>
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{pick("批量拆分", "Batch split")}</legend>
          <div className="mt-1 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="space-y-2 text-sm"><span>{pick("每个输出文件的页码范围，用分号分隔", "Page range for each output, separated by semicolons")}</span><Input value={splitSpec} onChange={(event) => setSplitSpec(event.target.value)} placeholder={pick("例如：1-3；4-8；9-12", "For example: 1-3; 4-8; 9-12")} /><span className="block text-xs text-muted-foreground">{format("将生成 {count} 个 PDF，并打包为 ZIP。", "Creates {count} PDFs and bundles them in a ZIP.", { count: splitGroups.length })}</span></label>
            <Button variant="outline" disabled={running || !splitGroups.length} onClick={() => void exportSplitGroups()}>{running ? <LoaderCircle className="animate-spin" /> : <Package />}{pick("拆分并下载 ZIP", "Split and download ZIP")}</Button>
          </div>
        </fieldset>
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{pick("PDF 压缩方式", "PDF compression")}</legend>
          <div className="mt-1 grid gap-3 lg:grid-cols-3">
            <CompressionChoice
              checked={compressionMode === "structure"}
              onChange={() => setCompressionMode("structure")}
              title={pick("结构优化（推荐）", "Structural optimization (recommended)")}
              description={pick("重建文件并移除未引用结构；保留可搜索文本与矢量内容。是否变小取决于原文件。", "Rebuilds the file and removes unreferenced structure while retaining searchable text and vectors. Size reduction depends on the source.")}
            />
            <CompressionChoice
              checked={compressionMode === "balanced"}
              onChange={() => setCompressionMode("balanced")}
              title={pick("屏幕分享", "Screen sharing")}
              description={pick("约 110 DPI / 中等质量。会把每页栅格化，适合查看与传阅，但不再支持文本搜索、链接和表单。", "About 110 DPI at medium quality. Rasterizes every page for viewing and sharing, removing text search, links, and forms.")}
            />
            <CompressionChoice
              checked={compressionMode === "smallest"}
              onChange={() => setCompressionMode("smallest")}
              title={pick("最小体积", "Smallest size")}
              description={pick("约 82 DPI / 较低质量。仅适合预览或扫描件；小字和细线可能模糊。", "About 82 DPI at lower quality. Best only for previews or scans; small text and fine lines may blur.")}
            />
          </div>
          {compressionMode !== "structure" ? <Alert className="mt-4 border-amber-500/30 bg-amber-500/[.06] text-amber-950 dark:text-amber-100"><AlertTriangle /><AlertTitle>{pick("有损压缩会改变页面内容", "Lossy compression changes page content")}</AlertTitle><AlertDescription>{format("数字签名、文本层、链接、表单和矢量内容不会保留；一次最多 {count} 页。请保留原文件并抽查结果。", "Digital signatures, text layers, links, forms, and vectors are not retained; process up to {count} pages at once. Keep the source and review the result.", { count: PDF_RASTER_COMPRESSION_MAX_PAGES })}</AlertDescription></Alert> : null}
        </fieldset>
        {running || progress ? <div className="space-y-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[.06] p-4"><div className="flex items-center justify-between gap-3 text-sm"><span>{progressText}</span><span>{progress}%</span></div><Progress value={progress} />{running ? <Button size="sm" variant="outline" onClick={cancelExport}><X />{pick("取消导出", "Cancel export")}</Button> : null}</div> : null}
        {delivery ? <Alert className="border-emerald-500/30 bg-emerald-500/[.07] text-emerald-950 dark:text-emerald-100"><FileCheck2 /><AlertTitle>{pick("交付文件已校验", "Delivery file verified")}</AlertTitle><AlertDescription><p>{format("{name} · {pages} 页 · {size}", "{name} · {pages} pages · {size}", { name: delivery.filename, pages: delivery.pages, size: formatBytes(delivery.bytes) })}</p><p className="mt-1 text-xs opacity-80">{pick("已核对页数和文档属性设置；请仍人工检查表单、链接和版面。", "Page count and document-property settings were checked; still review forms, links, and layout manually.")}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => downloadBlob(delivery.blob, delivery.filename)}><Download />{pick("再次下载", "Download again")}</Button><Button size="sm" variant="outline" onClick={downloadDeliveryReport}><Download />{pick("下载交付报告", "Download delivery report")}</Button>{onContinueToImages ? <Button size="sm" variant="outline" onClick={() => onContinueToImages(new File([delivery.blob], delivery.filename, { type: "application/pdf", lastModified: Date.now() }))}>{pick("继续转图片", "Continue to images")}<ArrowRight /></Button> : null}</div></AlertDescription></Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={running} onClick={() => void exportPages(pagePlan, false)}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{format("导出完整 PDF（{count} 页）", "Export complete PDF ({count} pages)", { count: pagePlan.length })}</Button>
          <Button variant="outline" disabled={running || !selectedPages.length} onClick={() => void exportPages(selectedPages, true)}><Download />{format("提取所选页面（{count} 页）", "Extract selected pages ({count})", { count: selectedPages.length })}</Button>
        </div>
      </CardContent>
    </Card> : null}
    {previewPageId && pagePlan.some((page) => page.id === previewPageId) ? <PdfPageDetailDialog
      activeId={previewPageId}
      pages={pagePlan}
      sourceById={sourceById}
      selectedIds={selectedIds}
      requestThumbnail={preview.requestThumbnail}
      onActiveChange={setPreviewPageId}
      onRotatePage={rotatePreviewPage}
      onMovePage={movePreviewPage}
      onTogglePageSelection={togglePreviewPageSelection}
      onRemovePage={removePreviewPage}
      onClose={closePagePreview}
    /> : null}
  </div>
}

function VirtualPdfPageGrid({
  pages,
  pagePlan,
  sourceById,
  selectedIds,
  running,
  onSelect,
  onDragStart,
  onDrop,
  requestThumbnail,
}: {
  pages: PdfWorkspacePage[]
  pagePlan: PdfWorkspacePage[]
  sourceById: Map<string, WorkspaceSource>
  selectedIds: Set<string>
  running: boolean
  onSelect: (pageId: string, event: ReactMouseEvent) => void
  onDragStart: (pageId: string, event: DragEvent<HTMLElement>) => void
  onDrop: (pageId: string, event: DragEvent<HTMLElement>) => void
  requestThumbnail: (sourceId: string, pageIndex: number, targetWidth?: number, rotation?: number) => Promise<Blob>
}) {
  const { pick, format } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const [viewport, setViewport] = useState({ width: 0, scrollY: 0, height: 900, top: 0 })
  const outputIndexById = useMemo(() => new Map(pagePlan.map((page, index) => [page.id, index])), [pagePlan])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect()
        setViewport({
          width: rect.width,
          scrollY: window.scrollY,
          height: window.innerHeight,
          top: rect.top + window.scrollY,
        })
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  const columns = viewport.width >= 1_000 ? 5 : viewport.width >= 760 ? 4 : viewport.width >= 520 ? 3 : 2
  const gap = 12
  const cardWidth = Math.max(120, (Math.max(viewport.width, 280) - gap * (columns - 1)) / columns)
  const rowHeight = cardWidth / 0.72 + 70 + gap
  const rowCount = Math.ceil(pages.length / columns)
  const viewportStart = Math.max(0, viewport.scrollY - viewport.top)
  const startRow = Math.max(0, Math.floor(viewportStart / rowHeight) - 2)
  const endRow = Math.min(rowCount, Math.ceil((viewportStart + viewport.height) / rowHeight) + 2)
  const startIndex = startRow * columns
  const endIndex = Math.min(pages.length, endRow * columns)
  const windowedPages = pages.slice(startIndex, endIndex)

  return <div
    ref={containerRef}
    role="listbox"
    aria-label={pick("PDF 页面顺序", "PDF page order")}
    aria-multiselectable="true"
    className="relative"
    style={{ height: Math.max(rowHeight, rowCount * rowHeight) }}
  >
    <div className="absolute inset-x-0 grid gap-3" style={{ top: startRow * rowHeight, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {windowedPages.map((page) => {
        const source = sourceById.get(page.sourceId)
        const selected = selectedIds.has(page.id)
        const outputIndex = outputIndexById.get(page.id) ?? 0
        return <article
          key={page.id}
          data-pdf-page-id={page.id}
          role="option"
          tabIndex={0}
          draggable={!running}
          aria-selected={selected}
          onClick={(event) => onSelect(page.id, event)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            onSelect(page.id, event as unknown as ReactMouseEvent)
          }}
          onDragStart={(event) => onDragStart(page.id, event)}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move" }}
          onDrop={(event) => onDrop(page.id, event)}
          className={`group relative cursor-pointer overflow-hidden rounded-xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${selected ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/20" : "border-border bg-muted/10 hover:border-cyan-500/50"}`}
        >
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-[#fff] shadow-md ring-1 ring-white/20"><GripVertical className="size-3" />{outputIndex + 1}</div>
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-[#fff] shadow-md ring-1 ring-white/20 transition group-hover:bg-cyan-700"><Maximize2 className="size-3" />{pick("大图", "Preview")}</div>
          <LazyPdfThumbnail sourceId={page.sourceId} pageIndex={page.sourcePageIndex} rotation={page.rotation} requestThumbnail={requestThumbnail} />
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: source?.color ?? "#71717a" }} />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{source?.file.name ?? pick("未知来源", "Unknown source")}</p><p className="text-[11px] text-muted-foreground">{format("原始第 {page} 页", "Source page {page}", { page: page.sourcePageIndex + 1 })}{page.rotation ? ` · ${page.rotation}°` : ""}</p></div>
          </div>
        </article>
      })}
    </div>
  </div>
}

function PdfPageDetailDialog({
  activeId,
  pages,
  sourceById,
  selectedIds,
  requestThumbnail,
  onActiveChange,
  onRotatePage,
  onMovePage,
  onTogglePageSelection,
  onRemovePage,
  onClose,
}: {
  activeId: string
  pages: PdfWorkspacePage[]
  sourceById: Map<string, WorkspaceSource>
  selectedIds: Set<string>
  requestThumbnail: (sourceId: string, pageIndex: number, targetWidth?: number, rotation?: number) => Promise<Blob>
  onActiveChange: (pageId: string) => void
  onRotatePage: (pageId: string, degrees: -90 | 90) => void
  onMovePage: (pageId: string, direction: -1 | 1) => void
  onTogglePageSelection: (pageId: string) => void
  onRemovePage: (pageId: string) => void
  onClose: () => void
}) {
  const { pick, format } = useLanguage()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [rendered, setRendered] = useState<{ pageId: string; url: string; blob: Blob | null; failed: boolean }>({ pageId: "", url: "", blob: null, failed: false })
  const [zoomState, setZoomState] = useState({ pageId: activeId, value: 100 })
  const activeIndex = pages.findIndex((page) => page.id === activeId)
  const activePage = pages[activeIndex]
  const source = activePage ? sourceById.get(activePage.sourceId) : undefined
  const zoom = zoomState.pageId === activeId ? zoomState.value : 100
  const imageUrl = rendered.pageId === activeId ? rendered.url : ""
  const imageFailed = rendered.pageId === activeId && rendered.failed

  const move = useCallback((offset: -1 | 1) => {
    const nextIndex = activeIndex + offset
    if (nextIndex < 0 || nextIndex >= pages.length) return
    onActiveChange(pages[nextIndex].id)
  }, [activeIndex, onActiveChange, pages])

  const changeZoom = useCallback((next: number) => {
    setZoomState({ pageId: activeId, value: Math.max(50, Math.min(200, next)) })
  }, [activeId])

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()
    return () => { document.body.style.overflow = originalOverflow }
  }, [])

  useEffect(() => {
    if (!activePage) return
    let cancelled = false
    let objectUrl = ""
    void requestThumbnail(activePage.sourceId, activePage.sourcePageIndex, 1600, activePage.rotation).then((blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setRendered({ pageId: activePage.id, url: objectUrl, blob, failed: false })
    }).catch(() => {
      if (!cancelled) setRendered({ pageId: activePage.id, url: "", blob: null, failed: true })
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [activePage, requestThumbnail])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault()
        move(-1)
        return
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault()
        move(1)
        return
      }
      if (!event.ctrlKey && !event.metaKey && (event.key === "+" || event.key === "=")) {
        event.preventDefault()
        changeZoom(zoom + 25)
        return
      }
      if (!event.ctrlKey && !event.metaKey && event.key === "-") {
        event.preventDefault()
        changeZoom(zoom - 25)
        return
      }
      if (!event.ctrlKey && !event.metaKey && event.key === "0") {
        event.preventDefault()
        changeZoom(100)
        return
      }
      if (event.key !== "Tab") return
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [changeZoom, move, onClose, zoom])

  if (!activePage || activeIndex < 0) return null
  const titleId = "pdf-page-detail-title"
  const descriptionId = "pdf-page-detail-description"
  const imageBlob = rendered.pageId === activeId ? rendered.blob : null
  const imageFileName = `${source ? baseName(source.file.name) : "tabnative-pdf"}-page-${activePage.sourcePageIndex + 1}.png`

  return <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
    onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}
  >
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl sm:max-h-[calc(100vh-3rem)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 sm:px-5">
        <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: source?.color ?? "#71717a" }} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-base font-semibold">{format("输出第 {current} / {total} 页", "Output page {current} of {total}", { current: activeIndex + 1, total: pages.length })}</h2>
          <p id={descriptionId} className="mt-1 truncate text-xs text-muted-foreground">{source?.file.name ?? pick("未知来源", "Unknown source")} · {format("原始第 {page} 页", "Source page {page}", { page: activePage.sourcePageIndex + 1 })} · {activePage.rotation ? `${activePage.rotation}°` : pick("未旋转", "Not rotated")} · {selectedIds.has(activePage.id) ? pick("已选择", "Selected") : pick("未选择", "Not selected")}</p>
        </div>
        <Button ref={closeButtonRef} size="icon-sm" variant="outline" onClick={onClose} aria-label={pick("关闭页面大图", "Close page preview")}><X /></Button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-zinc-950/95 p-4 sm:p-6">
        {imageUrl ? <img
          src={imageUrl}
          alt={format("输出第 {page} 页大图", "Large preview of output page {page}", { page: activeIndex + 1 })}
          className={zoom === 100 ? "max-h-[calc(100vh-14rem)] max-w-full object-contain shadow-2xl" : "h-auto max-w-none object-contain shadow-2xl"}
          style={zoom === 100 ? undefined : { width: `${zoom}%` }}
        /> : imageFailed ? <div className="rounded-xl border border-white/15 bg-white/5 px-6 py-10 text-center text-sm text-zinc-300">{pick("无法生成这一页的大图，但仍可继续切换其他页面。", "Unable to render a large preview for this page. You can still navigate to other pages.")}</div> : <div role="status" className="flex items-center gap-2 text-sm text-zinc-300"><LoaderCircle className="animate-spin" />{pick("正在生成清晰大图", "Rendering a clear preview")}</div>}
      </div>

      <footer className="border-t border-border bg-muted/15">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <p className="mr-auto text-xs font-semibold text-foreground">{pick("编辑当前页", "Edit this page")}</p>
          <Button size="sm" variant="outline" disabled={!imageBlob} onClick={() => imageBlob && downloadBlob(imageBlob, imageFileName)}><Download />{pick("导出当前页 PNG", "Export page as PNG")}</Button>
          <Button size="sm" variant={selectedIds.has(activePage.id) ? "default" : "outline"} onClick={() => onTogglePageSelection(activePage.id)}><CheckSquare2 />{selectedIds.has(activePage.id) ? pick("取消选择", "Deselect") : pick("选择此页", "Select page")}</Button>
          <Button size="sm" variant="outline" onClick={() => onRotatePage(activePage.id, -90)}><RotateCcw />{pick("左转", "Rotate left")}</Button>
          <Button size="sm" variant="outline" onClick={() => onRotatePage(activePage.id, 90)}><RotateCw />{pick("右转", "Rotate right")}</Button>
          <Button size="sm" variant="outline" disabled={activeIndex === 0} onClick={() => onMovePage(activePage.id, -1)}><ArrowLeft />{pick("前移", "Move earlier")}</Button>
          <Button size="sm" variant="outline" disabled={activeIndex === pages.length - 1} onClick={() => onMovePage(activePage.id, 1)}>{pick("后移", "Move later")}<ArrowRight /></Button>
          <Button size="sm" variant="destructive" disabled={pages.length <= 1} onClick={() => onRemovePage(activePage.id)}><Trash2 />{pick("删除此页", "Remove page")}</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">{pick("方向键翻页 · +/- 缩放 · 0 重置 · Esc 关闭", "Arrow keys navigate · +/- zoom · 0 reset · Esc close")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={activeIndex === 0} onClick={() => move(-1)}><ArrowLeft />{pick("上一页", "Previous")}</Button>
          <Button size="icon-sm" variant="outline" disabled={zoom <= 50} onClick={() => changeZoom(zoom - 25)} aria-label={pick("缩小大图", "Zoom out")}><ZoomOut /></Button>
          <Button size="sm" variant="ghost" onClick={() => changeZoom(100)} aria-label={pick("恢复 100%", "Reset to 100%")}>{zoom}%</Button>
          <Button size="icon-sm" variant="outline" disabled={zoom >= 200} onClick={() => changeZoom(zoom + 25)} aria-label={pick("放大大图", "Zoom in")}><ZoomIn /></Button>
          <Button size="sm" variant="outline" disabled={activeIndex === pages.length - 1} onClick={() => move(1)}>{pick("下一页", "Next")}<ArrowRight /></Button>
        </div>
        </div>
      </footer>
    </div>
  </div>
}

function PdfSelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="space-y-2 text-sm"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>
}

function CompressionChoice({ checked, onChange, title, description }: { checked: boolean; onChange: () => void; title: string; description: string }) {
  return <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${checked ? "border-cyan-500 bg-cyan-500/10" : "border-border"}`}><input type="radio" name="pdf-compression-mode" checked={checked} onChange={onChange} className="mt-1 size-4 accent-cyan-500" /><span><span className="text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></label>
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
  if (reason.message.startsWith("raster-limit:")) return pick("栅格压缩的总页数超过浏览器安全上限，请缩小范围或使用结构优化。", "The raster-compression page count exceeds the browser safety limit. Narrow the range or use structural optimization.")
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
