"use client"

import {
  ArrowUpRight,
  AudioLines,
  Bot,
  BookOpen,
  Check,
  Code2,
  ExternalLink,
  Globe2,
  Palette,
  PenLine,
  Search,
  Video,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import {
  aiDirectoryCategories,
  aiDirectoryTools,
  getAiDirectoryCategory,
  type AiDirectoryCategoryId,
  type AiDirectoryTool,
} from "@/lib/ai-directory"

type CategoryFilter = "all" | AiDirectoryCategoryId

const categoryIcons: Record<AiDirectoryCategoryId, LucideIcon> = {
  "china-agents": Bot,
  assistants: Bot,
  research: BookOpen,
  productivity: PenLine,
  coding: Code2,
  image: Palette,
  video: Video,
  audio: AudioLines,
  automation: Workflow,
}

export function AiToolDirectory() {
  const { pick } = useLanguage()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CategoryFilter>("all")
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLowerCase()

  const filteredTools = useMemo(() => aiDirectoryTools.filter((tool) => {
    const toolCategory = getAiDirectoryCategory(tool.category)
    const matchesCategory = category === "all" || tool.category === category
    const haystack = [
      tool.name,
      tool.description,
      tool.descriptionZh,
      ...tool.tags,
      toolCategory.title,
      toolCategory.titleZh,
    ].join(" ").toLowerCase()
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery))
  }), [category, normalizedQuery])

  const groups = useMemo(() => aiDirectoryCategories
    .map((item) => ({ ...item, tools: filteredTools.filter((tool) => tool.category === item.id) }))
    .filter((item) => item.tools.length > 0), [filteredTools])

  const featuredTools = aiDirectoryTools.filter((tool) => tool.featured)
  const showFeatured = !normalizedQuery && category === "all"

  function clearFilters() {
    setQuery("")
    setCategory("all")
    inputRef.current?.focus()
  }

  return (
    <>
      {showFeatured ? (
        <section aria-labelledby="featured-ai-tools" className="border-b border-white/10 bg-[#0b0b0b]">
          <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:py-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">{pick("编辑推荐入口", "Editor's shortlist")}</p>
                <h2 id="featured-ai-tools" className="mt-2 text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">
                  {pick("先从这些工具开始", "Start with these")}
                </h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-zinc-500">
                {pick("覆盖主流助手、研究、创作、编程和自动化的代表平台。", "A balanced starting set across assistants, research, creation, coding, and automation.")}
              </p>
            </div>
            <div className="mt-7 grid border-l border-t border-white/15 sm:grid-cols-2 lg:grid-cols-4">
              {featuredTools.map((tool) => <FeaturedToolCard key={tool.slug} tool={tool} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section id="directory" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-12 sm:px-8 lg:py-16">
        <div className="grid gap-7 border-b border-white/10 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">{pick("AI 工具目录", "AI tools directory")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">
              {pick("按你要完成的任务查找", "Find the right tool for the job")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              {pick("全部为官方直链。搜索会匹配名称、用途、分类和标签。", "Every result links directly to the official product. Search matches names, use cases, categories, and tags.")}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-cyan-200">
            <Check className="size-3.5" /> {pick("无赞助排名", "No sponsored ranking")}
          </div>
        </div>

        <div className="mt-7">
          <label className="flex h-14 items-center gap-4 rounded-lg border border-white/15 bg-white/[.025] px-4 transition focus-within:border-cyan-300/50 focus-within:ring-4 focus-within:ring-cyan-300/5">
            <Search className="size-5 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              placeholder={pick("搜索 ChatGPT、视频、研究、自动化…", "Search ChatGPT, video, research, automation…")}
              aria-label={pick("搜索 AI 工具", "Search AI tools")}
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={pick("清空搜索", "Clear search")}>
                <X className="size-4" />
              </button>
            ) : null}
          </label>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label={pick("AI 工具分类", "AI tool categories")}>
          <CategoryButton active={category === "all"} onClick={() => setCategory("all")} label={pick("全部分类", "All categories")} count={aiDirectoryTools.length} />
          {aiDirectoryCategories.map((item) => (
            <CategoryButton
              key={item.id}
              active={category === item.id}
              onClick={() => setCategory(item.id)}
              label={pick(item.titleZh, item.title)}
              count={aiDirectoryTools.filter((tool) => tool.category === item.id).length}
            />
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-y border-white/10 py-3">
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-zinc-100">{filteredTools.length}</span> {pick("个匹配平台", "matching platforms")}
          </p>
          {(query || category !== "all") ? (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-cyan-300 transition hover:text-cyan-200">
              {pick("重置筛选", "Reset filters")}
            </button>
          ) : null}
        </div>

        <div className="mt-10 space-y-12">
          {groups.length ? groups.map((group) => {
            const Icon = categoryIcons[group.id]
            return (
              <section key={group.id} id={`ai-category-${group.id}`} className="scroll-mt-28" aria-labelledby={`ai-category-${group.id}-title`}>
                <div className="mb-5 flex items-start justify-between gap-5">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-cyan-300">
                      <Icon className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3 id={`ai-category-${group.id}-title`} className="text-lg font-semibold text-zinc-100">{pick(group.titleZh, group.title)}</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">{pick(group.descriptionZh, group.description)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">{group.tools.length} {pick("个工具", "tools")}</span>
                </div>
                <div className="grid border-l border-t border-white/15 md:grid-cols-2 xl:grid-cols-3">
                  {group.tools.map((tool) => <AiToolCard key={tool.slug} tool={tool} />)}
                </div>
              </section>
            )
          }) : (
            <div className="border border-white/10 px-5 py-16 text-center">
              <Search className="mx-auto size-6 text-zinc-700" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-zinc-300">{pick("没有找到匹配的平台", "No platforms match those filters")}</p>
              <p className="mt-2 text-sm text-zinc-600">{pick("试试更宽泛的关键词，或重置分类筛选。", "Try a broader term, or reset the category filter.")}</p>
              <button type="button" onClick={clearFilters} className="mt-5 text-xs font-semibold text-cyan-300 hover:text-cyan-200">{pick("查看全部工具", "View all tools")}</button>
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-4 border-t border-white/10 pt-7 text-xs leading-5 text-zinc-600 sm:grid-cols-2">
          <p className="flex items-start gap-2"><ExternalLink className="mt-0.5 size-4 shrink-0" />{pick("外链在新标签页打开。TabNative 不代理登录、付款或文件上传。", "External products open in a new tab. TabNative does not proxy sign-in, payment, or file uploads.")}</p>
          <p className="flex items-start gap-2"><Globe2 className="mt-0.5 size-4 shrink-0" />{pick("价格、功能和地区可用性可能变化，请以各平台官方说明为准。", "Pricing, features, and regional availability can change; check each product's official terms.")}</p>
        </div>
      </section>
    </>
  )
}

function CategoryButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm transition ${active ? "border-cyan-300/40 bg-cyan-300/[.08] text-cyan-200" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-200"}`}>
      {label}<span className="font-mono text-[10px] opacity-60">{count}</span>
    </button>
  )
}

function FeaturedToolCard({ tool }: { tool: AiDirectoryTool }) {
  const { pick } = useLanguage()
  const Icon = categoryIcons[tool.category]
  return (
    <a href={tool.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="group flex min-h-[166px] flex-col border-b border-r border-white/15 p-5 transition hover:z-10 hover:bg-white/[.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50">
      <span className="flex items-start justify-between gap-4">
        <span className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-zinc-300 transition group-hover:border-cyan-300/25 group-hover:text-cyan-300"><Icon className="size-[18px]" strokeWidth={1.8} /></span>
        <ArrowUpRight className="size-4 text-zinc-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </span>
      <strong className="mt-5 text-base text-zinc-100">{tool.name}</strong>
      <span className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{pick(tool.descriptionZh, tool.description)}</span>
    </a>
  )
}

function AiToolCard({ tool }: { tool: AiDirectoryTool }) {
  const { pick } = useLanguage()
  const Icon = categoryIcons[tool.category]
  return (
    <a href={tool.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="group relative flex min-h-[248px] flex-col border-b border-r border-white/15 p-5 transition hover:z-10 hover:bg-white/[.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 sm:p-6">
      <span className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-zinc-300 transition group-hover:border-cyan-300/25 group-hover:text-cyan-300"><Icon className="size-5" strokeWidth={1.8} /></span>
        <ArrowUpRight className="size-4 text-zinc-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </span>
      <strong className="mt-5 text-lg tracking-[-.02em] text-zinc-100">{tool.name}</strong>
      <span className="mt-2 text-sm leading-6 text-zinc-500">{pick(tool.descriptionZh, tool.description)}</span>
      <span className="mt-auto flex flex-wrap gap-1.5 pt-5">
        {tool.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-md bg-white/[.035] px-2 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-zinc-600">{tag}</span>)}
      </span>
      <span className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-semibold text-zinc-500 transition group-hover:text-zinc-200">
        <span>{pick("官方网站", "Official site")}</span>
        <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </span>
    </a>
  )
}
