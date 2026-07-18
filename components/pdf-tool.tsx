"use client"

import { CircleHelp, FileImage, HardDrive, Images, Layers3, LockKeyhole } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { ImagesToPdfStudio, PdfToImagesStudio, type PdfFileHandoff } from "@/components/pdf-conversion-studios"
import { PdfWorkspace } from "@/components/pdf-workspace"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parsePdfPageSpec } from "@/lib/pdf-conversion"

export type PdfToolMode = "workspace" | "images" | "export"

const PDF_TOOL_MODES: PdfToolMode[] = ["workspace", "images", "export"]

export function PdfTool() {
  const { pick } = useLanguage()
  const [mode, setMode] = useState<PdfToolMode>("workspace")
  const [workspaceHandoff, setWorkspaceHandoff] = useState<PdfFileHandoff | null>(null)
  const [imageHandoff, setImageHandoff] = useState<PdfFileHandoff | null>(null)

  function continueWith(file: File, target: "workspace" | "export") {
    const handoff = { id: crypto.randomUUID(), file }
    if (target === "workspace") setWorkspaceHandoff(handoff)
    else setImageHandoff(handoff)
    setMode(target)
    window.requestAnimationFrame(() => document.getElementById(`pdf-panel-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === "ArrowRight") nextIndex = (index + 1) % PDF_TOOL_MODES.length
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + PDF_TOOL_MODES.length) % PDF_TOOL_MODES.length
    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = PDF_TOOL_MODES.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    setMode(PDF_TOOL_MODES[nextIndex])
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=tab]")
    tabs?.[nextIndex]?.focus()
  }

  const tabs = [
    { id: "workspace" as const, icon: Layers3, label: pick("页面装配", "Page assembly") },
    { id: "images" as const, icon: Images, label: pick("图片转 PDF", "Images to PDF") },
    { id: "export" as const, icon: FileImage, label: pick("PDF 转图片", "PDF to images") },
  ]

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div className="min-w-0 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{pick("PDF 页面装配台", "PDF Page Assembly")}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{pick("汇入多个 PDF，逐页查看和重组，再按统一规则导出；也可在图片与 PDF 之间进行可预览、可配置的本地转换。", "Bring multiple PDFs into one assembly, inspect and rebuild them page by page, then export under consistent rules. Previewable image conversions remain available.")}</p>
        </CardHeader>
        <CardContent>
          <div role="tablist" aria-label={pick("PDF 工具模式", "PDF tool modes")} className="grid gap-2 sm:grid-cols-3">
            {tabs.map((tab, index) => {
              const Icon = tab.icon
              const selected = mode === tab.id
              return <Button
                key={tab.id}
                id={`pdf-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`pdf-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                variant={selected ? "default" : "outline"}
                onClick={() => setMode(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              ><Icon />{tab.label}</Button>
            })}
          </div>
        </CardContent>
      </Card>

      <section id="pdf-panel-workspace" role="tabpanel" aria-labelledby="pdf-tab-workspace" hidden={mode !== "workspace"} tabIndex={0}><PdfWorkspace incomingPdf={workspaceHandoff} onContinueToImages={(file) => continueWith(file, "export")} /></section>
      <section id="pdf-panel-images" role="tabpanel" aria-labelledby="pdf-tab-images" hidden={mode !== "images"} tabIndex={0}><ImagesToPdfStudio onContinueToWorkspace={(file) => continueWith(file, "workspace")} /></section>
      <section id="pdf-panel-export" role="tabpanel" aria-labelledby="pdf-tab-export" hidden={mode !== "export"} tabIndex={0}><PdfToImagesStudio incomingPdf={imageHandoff} /></section>
    </div>

    <PdfToolAside mode={mode} />
  </div>
}

function PdfToolAside({ mode }: { mode: PdfToolMode }) {
  const { pick } = useLanguage()
  const modeLabel = mode === "workspace"
    ? pick("页面装配", "Page assembly")
    : mode === "images"
      ? pick("图片转 PDF", "Images to PDF")
      : pick("PDF 转图片", "PDF to images")
  const notes = mode === "workspace"
    ? [
        pick("原始 PDF 不会被修改", "Source PDFs are never changed"),
        pick("缩略图与导出均在后台 Worker 中处理", "Thumbnails and exports run in background Workers"),
        pick("单个最大 150 MB，整批最大 300 MB，最多 1000 页", "150 MB per file, 300 MB per workspace, up to 1,000 pages"),
      ]
    : mode === "images"
      ? [
          pick("支持 JPG、PNG 与 WebP", "Supports JPG, PNG, and WebP"),
          pick("最多 60 张，合计 250 MB，单张最高 40 MP", "Up to 60 images, 250 MB total, and 40 MP per image"),
          pick("图片顺序、纸张、方向和边距都可调整", "Image order, paper, orientation, and margins are configurable"),
        ]
      : [
          pick("单个 PDF 最大 150 MB", "One PDF up to 150 MB"),
          pick("先预览前 12 页，再按页码范围转换", "Preview the first 12 pages, then convert by page range"),
          pick("一次最多转换 200 页，多页自动打包为 ZIP", "Convert up to 200 pages per run; multiple pages are zipped"),
        ]

  return <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><HardDrive className="size-4 text-cyan-600" />{pick("PDF 本地处理", "Local PDF processing")}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <InfoRow label={pick("当前模式", "Current mode")} value={<span aria-live="polite">{modeLabel}</span>} />
        <InfoRow label={pick("处理方式", "Processing")} value={pick("后台 Worker", "Background Worker")} />
        <InfoRow label={pick("文件位置", "File location")} value={pick("仅当前设备", "This device only")} />
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><LockKeyhole className="size-4 text-cyan-600" />{pick("隐私保证", "Privacy guarantee")}</CardTitle></CardHeader>
      <CardContent><p className="text-sm leading-6 text-muted-foreground">{pick("文件内容不会上传到 TabNative 服务端；关闭页面前请下载需要保留的结果。", "File contents are not uploaded to the TabNative server. Download anything you want to keep before closing the page.")}</p></CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CircleHelp className="size-4 text-cyan-600" />{pick("当前模式提示", "Tips for this mode")}</CardTitle></CardHeader>
      <CardContent><ul className="space-y-2 text-sm leading-6 text-muted-foreground">{notes.map((note) => <li key={note} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-500" />{note}</li>)}</ul></CardContent>
    </Card>
  </aside>
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium text-foreground">{value}</span></div>
}

export const parsePages = parsePdfPageSpec
