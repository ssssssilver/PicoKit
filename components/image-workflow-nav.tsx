"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import { useLanguage } from "@/components/language-provider"
import { cn } from "@/lib/utils"

type WorkflowStep = "remove" | "edit" | "optimize"

const steps: Array<{ id: WorkflowStep; href: string; zh: string; en: string }> = [
  { id: "remove", href: "/remove-background", zh: "批量去背景", en: "Batch remove" },
  { id: "edit", href: "/image-editor", zh: "批量快速修图", en: "Batch quick edit" },
  { id: "optimize", href: "/image-compressor", zh: "批量优化", en: "Batch optimize" },
]

export function ImageWorkflowNav({ active }: { active: WorkflowStep }) {
  const { pick } = useLanguage()
  const activeIndex = steps.findIndex((step) => step.id === active)

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-cyan-300/20 bg-cyan-300/[.035]" aria-label={pick("批量图片处理", "Batch Image Processing")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{pick("批量图片处理", "Batch Image Processing")}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{pick("每一步都在当前浏览器运行；使用结果页按钮可把整批图片直接接力到下一步。", "Every step runs in this browser; result actions pass the full image batch directly to the next tool.")}</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.14em] text-cyan-300">On-device</span>
      </div>
      <ol className="grid md:grid-cols-3" dir="ltr">
        {steps.map((step, index) => {
          const current = step.id === active
          const completed = index < activeIndex
          return (
            <li key={step.id} className="relative min-w-0 border-b border-white/10 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <Link href={step.href} aria-current={current ? "step" : undefined} className={cn("group flex h-full min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-white/[.035]", current && "bg-cyan-300/[.075]")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[10px]", current ? "border-cyan-300 bg-cyan-300 text-[#07111f]" : completed ? "border-emerald-300/40 text-emerald-300" : "border-white/15 text-zinc-500")}>
                  {completed ? <CheckCircle2 className="size-4" /> : index + 1}
                </span>
                <span className="min-w-0" dir="auto">
                  <span className={cn("block truncate text-xs font-semibold", current ? "text-cyan-200" : "text-zinc-300")}>{pick(step.zh, step.en)}</span>
                </span>
                {index < steps.length - 1 ? <ArrowRight className="ml-auto hidden size-3.5 shrink-0 text-zinc-700 md:block" /> : null}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
