"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { useLanguage } from "@/components/language-provider"
import { allTools, toolCategories } from "@/lib/site"

type HeroSlide = {
  id: string
  eyebrow: { zh: string; en: string }
  title: { zh: string; en: string }
  description: { zh: string; en: string }
  action: { zh: string; en: string }
  href: string
  imageSrc: string
}

export const homeHeroSlides: HeroSlide[] = [
  {
    id: "image-delivery",
    eyebrow: { zh: "特色功能 · 图片批量处理", en: "Batch Image Processing" },
    title: { zh: "一批图片，三步完成交付。", en: "One image batch. Three browser steps." },
    description: { zh: "批量去背景并逐项修边，整批接力到快速修图，再统一优化格式、尺寸与文件大小。队列在步骤间保留，文件始终留在你的设备上。", en: "Remove backgrounds and refine edges, pass the full batch to quick editing, then optimize format, dimensions, and file size together. The queue stays available between steps and files remain on your device." },
    action: { zh: "开始批量处理图片", en: "Open Batch Image Processing" },
    href: "/remove-background",
    imageSrc: "/illustrations/hero-image-workspace.webp",
  },
  {
    id: "documents",
    eyebrow: { zh: "特色功能 · PDF 批量处理", en: "Batch PDF Processing" },
    title: { zh: "整理 PDF 页面，不把文档交给云端。", en: "Organize PDF pages without handing the document to a cloud service." },
    description: { zh: "一次导入多个 PDF，查看每页大图，拖拽重排、批量旋转、删除或提取页面，并在后台完成页码、水印、压缩与导出。图片互转也可独立使用。", en: "Add multiple PDFs to one page workspace, drag to reorder, batch-rotate, remove, or extract pages, and export in a background Worker. Image conversion remains available separately." },
    action: { zh: "开始批量处理 PDF", en: "Open Batch PDF Processing" },
    href: "/pdf-tools",
    imageSrc: "/illustrations/hero-pdf-workspace.webp",
  },
  {
    id: "inspection",
    eyebrow: { zh: "AI 图片来源证据", en: "AI image provenance evidence" },
    title: { zh: "别只看一个 AI 百分比。", en: "Look beyond a single AI percentage." },
    description: { zh: "结合文件来源、可见平台标记与按需两级像素检测；快速结果存疑时自动增强复核，并明确展示冲突与限制。", en: "Combine file provenance, visible platform marks, and on-demand two-stage pixel checks, with enhanced review for weak fast-check results and clear disclosure of conflicts and limits." },
    action: { zh: "检查图片来源证据", en: "Inspect image provenance" },
    href: "/ai-image-detector",
    imageSrc: "/illustrations/hero-ai-image-detection.webp",
  },
]

const dragThreshold = 56
export const heroRotationMs = 6_500

export function nextHeroSlideIndex(current: number, direction: -1 | 1, total = homeHeroSlides.length) {
  if (total <= 0) return 0
  return (current + direction + total) % total
}

export function HomeHeroBanner() {
  const { pick, format } = useLanguage()
  const [active, setActive] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, pointerId: -1 })
  const dragIntent = useRef<"horizontal" | "vertical" | null>(null)
  const slide = homeHeroSlides[active]

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotionPreference = () => setReducedMotion(media.matches)
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible")
    updateMotionPreference()
    updateVisibility()
    media.addEventListener("change", updateMotionPreference)
    document.addEventListener("visibilitychange", updateVisibility)
    return () => {
      media.removeEventListener("change", updateMotionPreference)
      document.removeEventListener("visibilitychange", updateVisibility)
    }
  }, [])

  useEffect(() => {
    if (isDragging || reducedMotion || !pageVisible || homeHeroSlides.length < 2) return
    const timer = window.setTimeout(() => {
      setActive((value) => nextHeroSlideIndex(value, 1))
    }, heroRotationMs)
    return () => window.clearTimeout(timer)
  }, [active, isDragging, pageVisible, reducedMotion])

  function localized(value: { zh: string; en: string }) {
    return value.en.includes("{tools}")
      ? format(value.zh, value.en, { tools: allTools.length, categories: toolCategories.length })
      : pick(value.zh, value.en)
  }

  function showPrevious() {
    setActive((value) => nextHeroSlideIndex(value, -1))
  }

  function showNext() {
    setActive((value) => nextHeroSlideIndex(value, 1))
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

      <div className="relative mx-auto min-h-[560px] px-0 py-12 sm:px-20 sm:py-14 lg:min-h-[520px] lg:px-24">
        <div
          key={slide.id}
          className={`grid min-h-[460px] w-full animate-in items-center gap-7 fade-in slide-in-from-bottom-2 duration-500 md:grid-cols-[minmax(0,1.05fr)_minmax(300px,.95fr)] md:gap-8 ${isDragging ? "transition-none" : "transition-transform duration-200 ease-out"}`}
          style={{ transform: `translate3d(${dragOffset}px, 0, 0)`, opacity: isDragging ? Math.max(.72, 1 - Math.abs(dragOffset) / 420) : 1 }}
        >
          <div className="relative z-10 max-w-[650px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[.2em] text-cyan-300">{localized(slide.eyebrow)}</p>
            <h1 className="mt-6 text-balance text-[clamp(2.65rem,4.4vw,4.35rem)] font-black leading-[1.02] tracking-[-0.06em] text-white">
              {localized(slide.title)}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">{localized(slide.description)}</p>
            <div className="mt-8">
              <Link href={slide.href} draggable={false} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-6 text-sm font-bold text-[#07111f] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25">
                {localized(slide.action)} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="relative isolate aspect-[2/1] min-h-44 w-full overflow-hidden md:aspect-auto md:min-h-[340px]" aria-hidden="true">
            <Image
              src={slide.imageSrc}
              alt=""
              fill
              priority={active === 0}
              draggable={false}
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) 42vw, 470px"
              className="hero-banner-illustration pointer-events-none object-contain"
            />
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
