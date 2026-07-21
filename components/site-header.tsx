"use client"

import Link from "next/link"
import { Blocks, Check, ChevronDown, Languages, Menu, Moon, Star, Sun, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"
import { useTheme } from "@/components/theme-provider"
import { useMyTools } from "@/components/use-my-tools"
import { getLanguageOption, languageOptions } from "@/lib/i18n"
import { toolCategories } from "@/lib/site"
import { toggleTheme } from "@/lib/theme"

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const languageRef = useRef<HTMLDivElement>(null)
  const { language, setLanguage, pick } = useLanguage()
  const { theme, setTheme } = useTheme()
  const { myToolHrefs } = useMyTools()

  const directoryLinks = toolCategories.map((category) => ({
    href: `/#tools-${category.id}`,
    title: pick(category.title, category.titleEn),
  }))

  useEffect(() => {
    function closeMore(event: PointerEvent) {
      if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        setLanguageOpen(false)
      }
    }
    window.addEventListener("pointerdown", closeMore)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("pointerdown", closeMore)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/94 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-3 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5" aria-label={pick("TabNative 首页", "TabNative home")}>
          <span className="grid size-9 place-items-center rounded-[10px] bg-cyan-300 text-[#07111f] sm:size-10">
            <Blocks className="size-5 sm:size-6" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-semibold tracking-[-0.03em] sm:text-xl">TabNative</span>
          <span className="hidden whitespace-nowrap rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:inline md:hidden">
            on-device
          </span>
        </Link>

        <nav className="mx-2 hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex" aria-label={pick("主导航", "Primary navigation")}>
          <Link href="/remove-background" title={pick("批量图片处理", "Batch Image Processing")} className="inline-flex max-w-24 min-w-0 items-center gap-1.5 rounded-md border border-cyan-300/25 bg-cyan-300/[.08] px-2 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-300/[.13] hover:text-cyan-100 lg:max-w-none lg:px-2.5 lg:text-sm">
            <Star className="size-3.5 shrink-0" fill="currentColor" aria-hidden="true" />
            <span className="truncate lg:hidden">{pick("图片流水线", "Image workflow")}</span>
            <span className="hidden whitespace-nowrap lg:inline">{pick("批量图片处理", "Batch Image Processing")}</span>
          </Link>
          <Link href="/pdf-tools" title={pick("PDF 批量处理", "Batch PDF Processing")} className="inline-flex max-w-24 min-w-0 items-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[.06] hover:text-cyan-100 lg:max-w-none lg:px-2.5 lg:text-sm">
            <Star className="size-3.5 shrink-0" fill="currentColor" aria-hidden="true" />
            <span className="truncate lg:hidden">{pick("PDF 处理", "Batch PDF Processing")}</span>
            <span className="hidden whitespace-nowrap lg:inline">{pick("PDF 批量处理", "Batch PDF Processing")}</span>
          </Link>
          <Link href="/ai-image-detector" title={pick("AI 图片检测", "AI image check")} className="inline-flex max-w-24 min-w-0 items-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[.06] hover:text-cyan-100 lg:max-w-none lg:px-2.5 lg:text-sm">
            <Star className="size-3.5 shrink-0" fill="currentColor" aria-hidden="true" />
            <span className="truncate lg:hidden">{pick("AI 图片检测", "AI image check")}</span>
            <span className="hidden whitespace-nowrap lg:inline">{pick("AI 图片检测", "AI image check")}</span>
          </Link>
          <Link href="/ai-tools" className="hidden whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white xl:inline-flex">
            {pick("AI 工具导航", "AI tools")}
          </Link>
          <Link href="/blog" className="hidden whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white xl:inline-flex">
            {pick("使用教程", "Guides")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setTheme(toggleTheme(theme))}
            className="grid size-10 place-items-center rounded-lg border border-white/15 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:border-cyan-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30"
            aria-label={theme === "dark" ? pick("切换到日间模式", "Switch to light mode") : pick("切换到夜间模式", "Switch to dark mode")}
            title={theme === "dark" ? pick("日间模式", "Light mode") : pick("夜间模式", "Dark mode")}
          >
            {theme === "dark" ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
          </button>
          <div ref={languageRef} className="relative">
            <button
              type="button"
              onClick={() => setLanguageOpen((value) => !value)}
              className="flex h-10 min-w-12 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:border-cyan-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30 sm:min-w-16 sm:px-2"
              aria-expanded={languageOpen}
              aria-haspopup="menu"
              aria-label={getLanguageOption(language).label}
              title={getLanguageOption(language).label}
            >
              <Languages className="size-[17px]" aria-hidden="true" />
              <span className="hidden max-w-14 truncate text-xs font-semibold min-[360px]:inline">{getLanguageOption(language).shortLabel}</span>
              <ChevronDown className={`size-3.5 transition-transform ${languageOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div
              role="menu"
              aria-hidden={!languageOpen}
              dir="ltr"
              className={`absolute right-0 top-[calc(100%+.65rem)] z-50 max-h-[min(70vh,32rem)] w-52 overflow-y-auto rounded-xl border border-white/15 bg-[#0d0d0d] p-1.5 text-left shadow-2xl transition ${languageOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}
            >
              {languageOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === option.code}
                  onClick={() => {
                    setLanguage(option.code)
                    setLanguageOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition ${language === option.code ? "bg-cyan-300/10 text-cyan-200" : "text-zinc-200 hover:bg-white/[.06] hover:text-white"}`}
                >
                  <span dir="auto">{option.label}</span>
                  {language === option.code ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </div>
          <Link href="/#my-tools" className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-cyan-300/20 px-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-300/[.06] hover:text-cyan-100 sm:inline-flex" aria-label={pick("查看我的工具", "View My tools")} title={pick("我的工具", "My tools")}>
            <Star className="size-[17px]" fill={myToolHrefs.length ? "currentColor" : "none"} />
            <span className="hidden xl:inline">{pick("我的工具", "My tools")}</span>
            {myToolHrefs.length ? <span className="rounded-full bg-cyan-300/10 px-1.5 font-mono text-[9px]">{myToolHrefs.length}</span> : null}
          </Link>
          <a
            href="https://github.com/ssssssilver/PicoKit"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden size-10 place-items-center rounded-lg border border-white/15 text-zinc-400 transition hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:border-cyan-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30 lg:grid"
            aria-label={pick("打开 GitHub 仓库", "Open GitHub repository")}
            title={pick("打开 GitHub 仓库", "Open GitHub repository")}
          >
            <GitHubMark />
          </a>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white xl:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? pick("关闭菜单", "Close menu") : pick("打开菜单", "Open menu")}>{open ? <X /> : <Menu />}</Button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-white/10 px-4 py-4 xl:hidden" aria-label={pick("移动端导航", "Mobile navigation")}>
          <div className="mx-auto grid max-w-[1280px] gap-1 sm:grid-cols-2">
            <Link href="/remove-background" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[.07] px-3 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[.12]"><Star className="size-4" fill="currentColor" />{pick("批量图片处理", "Batch Image Processing")}</Link>
            <Link href="/pdf-tools" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg border border-cyan-300/10 px-3 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[.07]"><Star className="size-4" fill="currentColor" />{pick("PDF 批量处理", "Batch PDF Processing")}</Link>
            <Link href="/ai-image-detector" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg border border-cyan-300/10 px-3 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[.07]"><Star className="size-4" fill="currentColor" />{pick("AI 图片检测", "AI image detector")}</Link>
            <Link href="/#tools" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-white hover:bg-white/8">{pick("常用工具", "Common tools")}</Link>
            <Link href="/#my-tools" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-cyan-200 hover:bg-cyan-300/[.07]"><Star className="size-4" />{pick("我的工具", "My tools")}{myToolHrefs.length ? <span className="font-mono text-[10px]">{myToolHrefs.length}</span> : null}</Link>
            <Link href="/ai-tools" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/8">{pick("AI 工具导航", "AI tools directory")}</Link>
            <Link href="/blog" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/8">{pick("使用教程", "Tool guides")}</Link>
            <details className="group sm:col-span-2">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-3 text-sm text-zinc-300 hover:bg-white/8">
                <span>{pick("更多工具与分类", "More tools and categories")}</span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-1 border-l border-white/10 pl-3 sm:grid-cols-2">
                {directoryLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/8">{item.title}</Link>)}
              </div>
            </details>
          </div>
        </nav>
      ) : null}
    </header>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden="true">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.2-3.09-.12-.29-.52-1.47.11-3.05 0 0 .98-.32 3.17 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.58.23 2.76.11 3.05.75.81 1.2 1.83 1.2 3.09 0 4.41-2.7 5.39-5.28 5.68.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  )
}
