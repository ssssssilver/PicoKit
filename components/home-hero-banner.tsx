"use client"

import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { useLanguage } from "@/components/language-provider"
import { allTools, toolCategories } from "@/lib/site"

type HeroSlide = {
  id: string
  eyebrow: { zh: string; en: string }
  title: { zh: string; en: string }
  description: { zh: string; en: string }
  action: { zh: string; en: string }
  href: string
}

export const homeHeroSlides: HeroSlide[] = [
  {
    id: "toolbox",
    eyebrow: { zh: "三步本地图片交付流水线", en: "Three-step local image workflow" },
    title: { zh: "一批图片，三步完成交付。", en: "One image batch. Three browser steps." },
    description: { zh: "批量去背景并逐项修边，整批接力到快速修图，再统一优化格式、尺寸与文件大小。队列在步骤间保留，文件始终留在你的设备上。", en: "Remove backgrounds and refine edges, pass the full batch to quick editing, then optimize format, dimensions, and file size together. The queue stays available between steps and files remain on your device." },
    action: { zh: "开启图片流水线", en: "Start with background removal" },
    href: "/remove-background",
  },
  {
    id: "images",
    eyebrow: { zh: "批量图片优化", en: "Batch image optimization" },
    title: { zh: "一组设置，处理整批图片。", en: "One set of controls for a whole image batch." },
    description: { zh: "统一转换 JPG、PNG 或 WebP，限制最长边、质量与目标 KB，按规则命名并打包下载。", en: "Convert to JPG, PNG, or WebP, cap the longest edge, quality, or target KB, apply a naming rule, and download one package." },
    action: { zh: "打开批量图片优化", en: "Open batch image optimizer" },
    href: "/image-compressor",
  },
  {
    id: "documents",
    eyebrow: { zh: "私密 PDF 工作台", en: "Private PDF workspace" },
    title: { zh: "整理 PDF 页面，不把文档交给云端。", en: "Organize PDF pages without handing the document to a cloud service." },
    description: { zh: "合并、提取、删除、排序或旋转页面，添加页码与文字水印，并在浏览器中导出。", en: "Merge, extract, delete, reorder, or rotate pages, add page numbers and text watermarks, then export in the browser." },
    action: { zh: "整理 PDF", en: "Organize a PDF" },
    href: "/pdf-tools",
  },
  {
    id: "inspection",
    eyebrow: { zh: "AI 图片来源证据", en: "AI image provenance evidence" },
    title: { zh: "别只看一个 AI 百分比。", en: "Look beyond a single AI percentage." },
    description: { zh: "分别检查可验证的文件来源、可见平台标记与像素模型估计，并明确展示冲突、缺失通道和限制。", en: "Inspect verifiable file provenance, visible platform marks, and pixel-model estimates separately, with conflicts, unavailable channels, and limits made explicit." },
    action: { zh: "检查图片来源证据", en: "Inspect image provenance" },
    href: "/ai-image-detector",
  },
]

const dragThreshold = 56

export function HomeHeroBanner() {
  const { pick, format } = useLanguage()
  const [active, setActive] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const dragStart = useRef({ x: 0, y: 0, pointerId: -1 })
  const dragIntent = useRef<"horizontal" | "vertical" | null>(null)
  const slide = homeHeroSlides[active]

  function localized(value: { zh: string; en: string }) {
    return value.en.includes("{tools}")
      ? format(value.zh, value.en, { tools: allTools.length, categories: toolCategories.length })
      : pick(value.zh, value.en)
  }

  function showPrevious() {
    setActive((value) => (value - 1 + homeHeroSlides.length) % homeHeroSlides.length)
  }

  function showNext() {
    setActive((value) => (value + 1) % homeHeroSlides.length)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0) return
    if ((event.target as HTMLElement).closest("a, button")) return
    dragStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    dragIntent.current = null
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!isDragging || dragStart.current.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragStart.current.x
    const deltaY = event.clientY - dragStart.current.y
    if (!dragIntent.current && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 6) {
      dragIntent.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical"
    }
    if (dragIntent.current !== "horizontal") return
    event.preventDefault()
    setDragOffset(Math.max(-120, Math.min(120, deltaX)))
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    if (!isDragging || dragStart.current.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragStart.current.x
    const deltaY = event.clientY - dragStart.current.y
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setIsDragging(false)
    setDragOffset(0)
    dragStart.current.pointerId = -1
    if (cancelled || dragIntent.current !== "horizontal" || Math.abs(deltaX) < dragThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) return
    if (deltaX > 0) showPrevious()
    else showNext()
  }

  return (
    <section className="mx-auto max-w-[1280px] px-5 sm:px-8">
      <div
        role="region"
        aria-roledescription={pick("轮播横幅", "carousel")}
        aria-label={pick("TabNative 工具能力", "TabNative capabilities")}
        className={`group relative overflow-hidden border-x border-b border-white/10 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishDrag(event)}
        onPointerCancel={(event) => finishDrag(event, true)}
      >
      <div aria-hidden="true" className="hero-banner-grid pointer-events-none absolute inset-0 opacity-40 [background-size:32px_32px]" />

      <div className="relative mx-auto flex min-h-[500px] items-center px-0 py-16 sm:min-h-[520px] sm:px-20 lg:px-24">
        <div
          key={slide.id}
          className={`w-full max-w-[980px] animate-in fade-in slide-in-from-bottom-2 duration-500 ${isDragging ? "transition-none" : "transition-transform duration-200 ease-out"}`}
          style={{ transform: `translate3d(${dragOffset}px, 0, 0)`, opacity: isDragging ? Math.max(.72, 1 - Math.abs(dragOffset) / 420) : 1 }}
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[.2em] text-cyan-300">{localized(slide.eyebrow)}</p>
          <h1 className="mt-6 max-w-[960px] text-[clamp(3rem,6vw,5.6rem)] font-black leading-[1.01] tracking-[-0.065em] text-white">
            {localized(slide.title)}
          </h1>
          <p className="mt-7 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">{localized(slide.description)}</p>
          <div className="mt-8">
            <Link href={slide.href} draggable={false} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-6 text-sm font-bold text-[#07111f] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25">
              {localized(slide.action)} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={showPrevious}
        className="hero-banner-arrow pointer-events-none absolute left-5 top-1/2 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 opacity-0 shadow-xl transition-[opacity,transform,border-color,color] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:scale-105 hover:border-cyan-300/50 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25 sm:grid"
        aria-label={pick("上一项工具能力", "Previous capability")}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={showNext}
        className="hero-banner-arrow pointer-events-none absolute right-5 top-1/2 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-white/15 opacity-0 shadow-xl transition-[opacity,transform,border-color,color] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:scale-105 hover:border-cyan-300/50 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25 sm:grid"
        aria-label={pick("下一项工具能力", "Next capability")}
      >
        <ChevronRight className="size-5" />
      </button>

        <div className="pointer-events-none absolute bottom-5 right-5 z-20 flex gap-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 sm:hidden">
          <button type="button" onClick={showPrevious} className="hero-banner-arrow grid size-11 place-items-center rounded-full border border-white/15 shadow-xl" aria-label={pick("上一项工具能力", "Previous capability")}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={showNext} className="hero-banner-arrow grid size-11 place-items-center rounded-full border border-white/15 shadow-xl" aria-label={pick("下一项工具能力", "Next capability")}>
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
