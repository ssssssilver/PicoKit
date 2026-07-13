"use client"

import Link from "next/link"
import { ArrowRight, LockKeyhole, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { allTools, primaryTools, utilityTools } from "@/lib/site"

const featuredTools = [primaryTools[0], primaryTools[1], primaryTools[2], utilityTools[0]]

const runtimeByHref: Record<string, string> = {
  "/ai-text-detector": "WEBGPU / WASM",
  "/ai-image-detector": "BROWSER WORKER",
  "/gemini-watermark-remover": "BROWSER WORKER",
}

export function HomeToolDirectory() {
  const { language, pick } = useLanguage()
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const normalized = query.trim().toLowerCase()
  const tools = useMemo(() => normalized
    ? allTools.filter((tool) => `${tool.title} ${tool.titleEn} ${tool.description} ${tool.descriptionEn}`.toLowerCase().includes(normalized))
    : featuredTools,
  [normalized])

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (event.key === "/" && !target?.matches("input, textarea, select")) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("")
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  return (
    <section id="tools" className="mx-auto max-w-[1280px] px-5 pb-16 pt-7 sm:px-8 lg:pb-20">
      <label className="flex h-[68px] items-center gap-4 rounded-lg border border-white/15 bg-white/[.025] px-5 transition focus-within:border-cyan-300/50 focus-within:ring-4 focus-within:ring-cyan-300/5">
        <Search className="size-5 shrink-0 text-zinc-500" />
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600" placeholder={pick("搜索工具、格式或功能…", "Search tools, formats, or features…")} aria-label={pick("搜索 PicoKit 工具", "Search PicoKit tools")} />
        {query ? <button type="button" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={pick("清空搜索", "Clear search")}><X className="size-4" /></button> : <kbd className="hidden rounded-md border border-white/15 px-2 py-1 font-mono text-xs text-zinc-500 sm:block">/</kbd>}
      </label>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-[.06em] text-zinc-300">{normalized ? pick("搜索结果", "Search results") : pick("核心工具", "Core tools")}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-zinc-600">{tools.length} tools</span>
      </div>

      <div className="mt-4 border border-white/15">
        {tools.length ? tools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link key={tool.href} href={tool.href} className="group grid min-h-[74px] items-center gap-4 border-b border-white/10 px-5 py-4 transition last:border-b-0 hover:bg-white/[.035] sm:grid-cols-[40px_220px_1fr_auto_auto_20px]">
              <Icon className="size-5 text-zinc-200 transition group-hover:text-cyan-300" strokeWidth={1.8} />
              <span className="text-lg font-semibold text-zinc-100">{language === "en" ? tool.titleEn : tool.title}</span>
              <span className="hidden text-[15px] leading-6 text-zinc-500 md:block">{language === "en" ? tool.descriptionEn : tool.description}</span>
              <span className="hidden items-center gap-2 font-mono text-[11px] tracking-[.08em] text-zinc-500 sm:flex"><span className="size-1.5 rounded-full bg-cyan-300" />ON-DEVICE</span>
              <span className="hidden w-32 text-right font-mono text-[11px] tracking-[.06em] text-zinc-500 lg:block">{runtimeByHref[tool.href] ?? "BROWSER WORKER"}</span>
              <ArrowRight className="size-4 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
            </Link>
          )
        }) : <div className="px-5 py-12 text-center text-sm text-zinc-500">{pick("没有匹配的工具，试试 “C2PA” 或 “压缩”。", "No matching tools. Try “C2PA” or “compress”.")}</div>}
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs leading-5 text-zinc-600"><LockKeyhole className="size-4" />{pick("完全在本地运行，文件不会离开你的设备，广告脚本无法访问处理过程。", "Everything runs locally. Files never leave your device, and ad scripts cannot access the processing flow.")}</p>
    </section>
  )
}
