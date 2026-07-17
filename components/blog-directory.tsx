"use client"

import Link from "next/link"
import {
  ArrowUpRight,
  Bot,
  Box,
  Clock3,
  Code2,
  FileText,
  ImageIcon,
  Search,
  Video,
  X,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { matchesLocalizedQuery } from "@/lib/localized-search"
import { commonToolHrefs, toolCategories, type ToolCategory } from "@/lib/site"
import { toolGuides } from "@/lib/tool-guides"

type CategoryFilter = "all" | ToolCategory

const categoryIcons: Record<ToolCategory, LucideIcon> = {
  ai: Bot,
  image: ImageIcon,
  privacy: FileText,
  file: FileText,
  media: Video,
  text: Code2,
  model: Box,
}

export function BlogDirectory() {
  const { pick } = useLanguage()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CategoryFilter>("all")
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLowerCase()

  const filteredGuides = useMemo(() => toolGuides.filter((guide) => {
    if (category !== "all" && guide.category !== category) return false
    if (!normalizedQuery) return true
    return matchesLocalizedQuery(
      normalizedQuery,
      [
        { zh: guide.title, en: guide.titleEn },
        { zh: guide.description, en: guide.descriptionEn },
        { zh: guide.categoryTitle, en: guide.categoryTitleEn },
      ],
      pick,
    )
  }), [category, normalizedQuery, pick])

  const featuredGuides = commonToolHrefs
    .map((href) => toolGuides.find((guide) => guide.href === href))
    .filter((guide): guide is (typeof toolGuides)[number] => Boolean(guide))
    .slice(0, 4)

  function reset() {
    setQuery("")
    setCategory("all")
    inputRef.current?.focus()
  }

  return (
    <>
      {!query && category === "all" ? (
        <section className="border-b border-white/10 bg-[#0b0b0b]" aria-labelledby="featured-guides-title">
          <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:py-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">{pick("常用工具教程", "Popular tool guides")}</p>
                <h2 id="featured-guides-title" className="mt-2 text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">{pick("从最常用的任务开始", "Start with common tasks")}</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-zinc-500">{pick("每篇都从准备文件开始，带你完成操作、验证结果并处理常见问题。", "Every guide starts with preparation, then walks through the task, verification, and common fixes.")}</p>
            </div>
            <div className="mt-7 grid border-l border-t border-white/15 sm:grid-cols-2 lg:grid-cols-4">
              {featuredGuides.map((guide) => <GuideCard key={guide.slug} guide={guide} compact />)}
            </div>
          </div>
        </section>
      ) : null}

      <section id="guides" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-12 sm:px-8 lg:py-16">
        <div className="grid gap-7 border-b border-white/10 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">{pick("全部教程", "All guides")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">{pick("找到你正在使用的工具", "Find the tool you are using")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{pick("按名称、用途或分类搜索。每个 TabNative 本地工具都有对应教程。", "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.")}</p>
          </div>
          <span className="font-mono text-xs uppercase tracking-[.16em] text-zinc-600">{toolGuides.length} {pick("篇教程", "guides")}</span>
        </div>

        <label className="mt-7 flex h-14 items-center gap-4 rounded-lg border border-white/15 bg-white/[.025] px-4 transition focus-within:border-cyan-300/50 focus-within:ring-4 focus-within:ring-cyan-300/5">
          <Search className="size-5 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder={pick("搜索图片压缩、PDF、二维码、AI 检测…", "Search image compression, PDF, QR code, AI detection…")}
            aria-label={pick("搜索工具教程", "Search tool guides")}
          />
          {query ? <button type="button" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={pick("清空搜索", "Clear search")}><X className="size-4" /></button> : null}
        </label>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label={pick("教程分类", "Guide categories")}>
          <CategoryButton active={category === "all"} label={pick("全部分类", "All categories")} count={toolGuides.length} onClick={() => setCategory("all")} />
          {toolCategories.map((item) => <CategoryButton key={item.id} active={category === item.id} label={pick(item.title, item.titleEn)} count={toolGuides.filter((guide) => guide.category === item.id).length} onClick={() => setCategory(item.id)} />)}
        </div>

        <div className="mt-8 flex items-center justify-between border-y border-white/10 py-3 text-sm">
          <p className="text-zinc-500"><strong className="text-zinc-100">{filteredGuides.length}</strong> {pick("篇匹配教程", "matching guides")}</p>
          {(query || category !== "all") ? <button type="button" onClick={reset} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">{pick("重置筛选", "Reset filters")}</button> : null}
        </div>

        {filteredGuides.length ? (
          <div className="mt-8 grid border-l border-t border-white/15 md:grid-cols-2 xl:grid-cols-3">
            {filteredGuides.map((guide) => <GuideCard key={guide.slug} guide={guide} />)}
          </div>
        ) : (
          <div className="mt-8 border border-white/10 px-5 py-16 text-center">
            <Search className="mx-auto size-6 text-zinc-700" />
            <p className="mt-4 text-sm font-semibold text-zinc-300">{pick("没有找到匹配教程", "No guides match")}</p>
            <button type="button" onClick={reset} className="mt-4 text-xs font-semibold text-cyan-300 hover:text-cyan-200">{pick("查看全部教程", "View all guides")}</button>
          </div>
        )}
      </section>
    </>
  )
}

function CategoryButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm transition ${active ? "border-cyan-300/40 bg-cyan-300/[.08] text-cyan-200" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-200"}`}>{label}<span className="font-mono text-[10px] opacity-60">{count}</span></button>
}

function GuideCard({ guide, compact = false }: { guide: (typeof toolGuides)[number]; compact?: boolean }) {
  const { pick, format } = useLanguage()
  const Icon = categoryIcons[guide.category]
  return (
    <Link href={`/blog/${guide.slug}`} className={`group flex flex-col border-b border-r border-white/15 p-5 transition hover:z-10 hover:bg-white/[.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 sm:p-6 ${compact ? "min-h-[220px]" : "min-h-[280px]"}`}>
      <span className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-zinc-300 transition group-hover:border-cyan-300/25 group-hover:text-cyan-300"><Icon className="size-5" strokeWidth={1.8} /></span>
        <ArrowUpRight className="size-4 text-zinc-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </span>
      <span className="mt-5 font-mono text-[10px] uppercase tracking-[.14em] text-cyan-300/80">{pick(guide.categoryTitle, guide.categoryTitleEn)}</span>
      <strong className="mt-2 text-lg tracking-[-.02em] text-zinc-100">{format("如何使用{name}", "How to use {name}", { name: pick(guide.title, guide.titleEn) })}</strong>
      {!compact ? <span className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-500">{pick(guide.description, guide.descriptionEn)}</span> : null}
      <span className="mt-auto flex items-center justify-between border-t border-white/10 pt-4 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{guide.readMinutes} {pick("分钟", "min read")}</span>
        <span className="font-semibold transition group-hover:text-cyan-300">{pick("阅读教程", "Read guide")}</span>
      </span>
    </Link>
  )
}
