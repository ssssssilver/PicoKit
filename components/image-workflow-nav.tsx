"use client"

import { Check, ImageDown, Paintbrush, Scissors, type LucideIcon } from "lucide-react"

import { useLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ImageWorkflowPanel = "remove" | "edit" | "optimize"

const panels: Array<{
  id: ImageWorkflowPanel
  icon: LucideIcon
  title: { zh: string; en: string }
  description: { zh: string; en: string }
}> = [
  {
    id: "remove",
    icon: Scissors,
    title: { zh: "去背景与成品", en: "Remove & finish" },
    description: { zh: "去背、修边、换背景", en: "Cut out, refine, replace" },
  },
  {
    id: "edit",
    icon: Paintbrush,
    title: { zh: "快速修图", en: "Quick edit" },
    description: { zh: "裁剪、调色、标注、打码", en: "Crop, tune, annotate, redact" },
  },
  {
    id: "optimize",
    icon: ImageDown,
    title: { zh: "输出与下载", en: "Output & download" },
    description: { zh: "格式、尺寸、质量、ZIP", en: "Format, size, quality, ZIP" },
  },
]

export function ImageWorkflowNav({
  active,
  counts,
  visited,
  onSelect,
}: {
  active: ImageWorkflowPanel
  counts: Record<ImageWorkflowPanel, number>
  visited: ReadonlySet<ImageWorkflowPanel>
  onSelect: (panel: ImageWorkflowPanel) => void
}) {
  const { pick, format } = useLanguage()

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label={pick("图片批量处理工具", "Batch image processing tools")}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-sm font-semibold text-foreground">{pick("选择本批次要使用的工具", "Choose tools for this batch")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{pick("三个工具都可跳过；切换回来时，当前页面内的队列仍会保留。", "Every tool is optional. Return to a panel and its queue remains available on this page.")}</p>
        </div>
        <Badge variant="outline" className="w-fit border-cyan-500/25 bg-cyan-500/[.07] text-cyan-700 dark:text-cyan-300">
          {format("当前工具 {count} 张", "{count} images in current tool", { count: counts[active] })}
        </Badge>
      </div>
      <div role="tablist" aria-label={pick("图片处理工具", "Image processing tools")} className="grid md:grid-cols-3" dir="ltr">
        {panels.map((panel) => {
          const Icon = panel.icon
          const current = panel.id === active
          const wasVisited = visited.has(panel.id)
          return (
            <button
              key={panel.id}
              type="button"
              role="tab"
              aria-selected={current}
              aria-controls={`image-workspace-panel-${panel.id}`}
              onClick={() => onSelect(panel.id)}
              className={cn(
                "group relative flex min-h-24 items-center gap-3 border-b border-border px-4 py-4 text-left transition last:border-b-0 hover:bg-muted/45 md:border-b-0 md:border-r md:last:border-r-0",
                current && "bg-cyan-500/[.08]",
              )}
            >
              <span className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl border transition",
                current
                  ? "border-cyan-500/35 bg-cyan-500 text-white"
                  : "border-border bg-muted/40 text-muted-foreground group-hover:text-foreground",
              )}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1" dir="auto">
                <span className={cn("flex items-center gap-2 text-sm font-semibold", current ? "text-cyan-700 dark:text-cyan-200" : "text-foreground")}>
                  {pick(panel.title.zh, panel.title.en)}
                  {!current && wasVisited ? <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label={pick("已使用", "Visited")} /> : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{pick(panel.description.zh, panel.description.en)}</span>
              </span>
              {counts[panel.id] ? <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{counts[panel.id]}</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
