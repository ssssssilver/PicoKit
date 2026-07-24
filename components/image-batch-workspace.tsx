"use client"

import dynamic from "next/dynamic"
import { CheckCircle2, Layers3, LoaderCircle, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useImageWorkflowMemory } from "@/components/image-workflow-memory"
import { type ImageWorkflowPanel, ImageWorkflowNav } from "@/components/image-workflow-nav"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const BackgroundRemovalBatchStudio = dynamic(
  () => import("@/components/background-removal-batch-studio").then((module) => module.BackgroundRemovalBatchStudio),
  { loading: WorkspaceLoading },
)
const QuickImageEditor = dynamic(
  () => import("@/components/quick-image-editor").then((module) => module.QuickImageEditor),
  { loading: WorkspaceLoading },
)
const ImageDeliveryStudio = dynamic(
  () => import("@/components/image-delivery-studio").then((module) => module.ImageDeliveryStudio),
  { loading: WorkspaceLoading },
)

const panelMemoryKeys: Record<ImageWorkflowPanel, string> = {
  remove: "remove-background",
  edit: "image-editor",
  optimize: "image-compressor",
}

const emptyCounts: Record<ImageWorkflowPanel, number> = { remove: 0, edit: 0, optimize: 0 }
const emptyFiles: readonly File[] = []

type PanelSeed = { files: readonly File[]; version: number }

export function ImageBatchWorkspace({ initialPanel = "remove" }: { initialPanel?: ImageWorkflowPanel }) {
  const { pick, format } = useLanguage()
  const workflowMemory = useImageWorkflowMemory()
  const activeRef = useRef<ImageWorkflowPanel>(initialPanel)
  const visitedRef = useRef(new Set<ImageWorkflowPanel>([initialPanel]))
  const panelFilesRef = useRef<Record<ImageWorkflowPanel, readonly File[]>>({
    remove: emptyFiles,
    edit: emptyFiles,
    optimize: emptyFiles,
  })
  const busyRef = useRef<Record<ImageWorkflowPanel, boolean>>({ remove: false, edit: false, optimize: false })
  const unsavedRef = useRef<Record<ImageWorkflowPanel, boolean>>({ remove: false, edit: false, optimize: false })
  const versionRef = useRef(0)

  const [active, setActive] = useState<ImageWorkflowPanel>(initialPanel)
  const [visited, setVisited] = useState<ReadonlySet<ImageWorkflowPanel>>(() => new Set([initialPanel]))
  const [counts, setCounts] = useState(emptyCounts)
  const [seeds, setSeeds] = useState<Partial<Record<ImageWorkflowPanel, PanelSeed>>>({})
  const [notice, setNotice] = useState("")

  const recordFiles = useCallback((panel: ImageWorkflowPanel, files: readonly File[]) => {
    panelFilesRef.current[panel] = files
    setCounts((current) => current[panel] === files.length ? current : { ...current, [panel]: files.length })
  }, [])

  const setPanelBusy = useCallback((panel: ImageWorkflowPanel, busy: boolean) => {
    busyRef.current[panel] = busy
  }, [])

  const setPanelUnsaved = useCallback((panel: ImageWorkflowPanel, unsaved: boolean) => {
    unsavedRef.current[panel] = unsaved
  }, [])

  const showPanel = useCallback((next: ImageWorkflowPanel, transferFiles?: readonly File[]) => {
    const current = activeRef.current
    if (next === current && !transferFiles) return
    if (busyRef.current[current]) {
      setNotice(pick("当前工具仍在处理图片，请等待完成或停止后再切换。", "This tool is still processing images. Wait for it to finish or stop it before switching."))
      return
    }
    if (unsavedRef.current[current]) {
      setNotice(pick("当前图片还有未保存的修改。请先保存到队列，再切换工具。", "The current image has unsaved edits. Save it to the queue before switching tools."))
      return
    }

    const firstVisit = !visitedRef.current.has(next)
    const files = transferFiles ?? panelFilesRef.current[current]
    const targetIsEmpty = panelFilesRef.current[next].length === 0
    if (firstVisit || transferFiles || (targetIsEmpty && files.length > 0)) {
      workflowMemory.delete(panelMemoryKeys[next])
      versionRef.current += 1
      setSeeds((currentSeeds) => ({
        ...currentSeeds,
        [next]: { files, version: versionRef.current },
      }))
      panelFilesRef.current[next] = files
      setCounts((currentCounts) => ({ ...currentCounts, [next]: files.length }))
    }

    visitedRef.current = new Set(visitedRef.current).add(next)
    setVisited(new Set(visitedRef.current))
    activeRef.current = next
    setActive(next)
    setNotice(transferFiles?.length
      ? format("已把当前 {count} 张图片带到新工具，无需重新选择。", "The current {count} images are ready in the new tool. No need to select them again.", { count: transferFiles.length })
      : "")

    const url = new URL(window.location.href)
    url.pathname = "/remove-background"
    if (next === "remove") url.searchParams.delete("panel")
    else url.searchParams.set("panel", next)
    url.searchParams.delete("batch")
    url.searchParams.delete("asset")
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  }, [format, pick, workflowMemory])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("panel")
    if (requested === "remove" || requested === "edit" || requested === "optimize") {
      showPanel(requested)
    }
  }, [showPanel])

  const recordRemovalFiles = useCallback((files: readonly File[]) => recordFiles("remove", files), [recordFiles])
  const recordEditorFiles = useCallback((files: readonly File[]) => recordFiles("edit", files), [recordFiles])
  const recordOutputFiles = useCallback((files: readonly File[]) => recordFiles("optimize", files), [recordFiles])
  const setRemovalBusy = useCallback((busy: boolean) => setPanelBusy("remove", busy), [setPanelBusy])
  const setEditorBusy = useCallback((busy: boolean) => setPanelBusy("edit", busy), [setPanelBusy])
  const setOutputBusy = useCallback((busy: boolean) => setPanelBusy("optimize", busy), [setPanelBusy])
  const setEditorUnsaved = useCallback((unsaved: boolean) => setPanelUnsaved("edit", unsaved), [setPanelUnsaved])
  const continueToEditor = useCallback((files: readonly File[]) => showPanel("edit", files), [showPanel])
  const continueToOutput = useCallback((files: readonly File[]) => showPanel("optimize", files), [showPanel])

  const currentSeed = seeds[active]

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-cyan-500/20 bg-gradient-to-br from-cyan-500/[.08] via-card to-card shadow-none">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-500 text-white shadow-[0_12px_30px_rgba(6,182,212,.18)]">
              <Layers3 className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{pick("一批图片，一个工作台", "One image batch, one workspace")}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{pick("只导入一次，按需使用去背景、快速修图和输出设置。工具不是必须按顺序完成的步骤，未使用的可以直接跳过。", "Import once, then use background removal, quick editing, and output settings only when needed. These are optional tools, not required sequential steps.")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-64 lg:justify-end">
            <Badge variant="outline" className="border-border bg-background/50"><CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />{pick("队列切换后保留", "Queues stay available")}</Badge>
            <Badge variant="outline" className="border-border bg-background/50"><ShieldCheck className="text-cyan-600 dark:text-cyan-400" />{pick("文件不上传", "Files stay local")}</Badge>
          </div>
        </CardContent>
      </Card>

      <ImageWorkflowNav active={active} counts={counts} visited={visited} onSelect={showPanel} />

      {notice ? <Alert className="border-cyan-500/25 bg-cyan-500/[.06]"><CheckCircle2 className="text-cyan-600 dark:text-cyan-400" /><AlertTitle>{pick("工作台提示", "Workspace note")}</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert> : null}

      <section
        id={`image-workspace-panel-${active}`}
        role="tabpanel"
        aria-label={pick("当前图片处理工具", "Current image processing tool")}
        className="min-w-0"
      >
        {active === "remove" ? (
          <BackgroundRemovalBatchStudio
            key={`remove-${currentSeed?.version ?? 0}`}
            initialFiles={currentSeed?.files}
            embedded
            onBatchChange={recordRemovalFiles}
            onBusyChange={setRemovalBusy}
            onContinue={continueToEditor}
          />
        ) : null}
        {active === "edit" ? (
          <QuickImageEditor
            key={`edit-${currentSeed?.version ?? 0}`}
            initialFiles={currentSeed?.files}
            embedded
            onBatchChange={recordEditorFiles}
            onBusyChange={setEditorBusy}
            onUnsavedChange={setEditorUnsaved}
            onContinue={continueToOutput}
          />
        ) : null}
        {active === "optimize" ? (
          <ImageDeliveryStudio
            key={`optimize-${currentSeed?.version ?? 0}`}
            initialFiles={currentSeed?.files}
            embedded
            onBatchChange={recordOutputFiles}
            onBusyChange={setOutputBusy}
          />
        ) : null}
      </section>
    </div>
  )
}

function WorkspaceLoading() {
  const { pick } = useLanguage()
  return <div role="status" className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-cyan-500" />{pick("正在打开工具", "Loading tools…")}</div>
}
