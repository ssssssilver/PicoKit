"use client"

import Link from "next/link"
import { CircleHelp, Languages, Menu, Search, ShieldCheck, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"
import { toggleLanguage } from "@/lib/i18n"
import { primaryTools, utilityTools } from "@/lib/site"

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { language, setLanguage, pick } = useLanguage()

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/94 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label={pick("PicoKit 首页", "PicoKit home")}>
          <span className="grid size-10 place-items-center rounded-[10px] bg-cyan-300 text-[#07111f]">
            <ShieldCheck className="size-6" strokeWidth={2.4} />
          </span>
          <span className="text-xl font-semibold tracking-[-0.03em]">PicoKit</span>
          <span className="hidden rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:inline">
            on-device
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={pick("主导航", "Primary navigation")}>
          {primaryTools.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
              {language === "en" ? item.titleEn : item.title}
            </Link>
          ))}
          <Link href="/image-compressor" className="rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
            {pick("图片工具", "Image tools")}
          </Link>
          <Link href="/methodology" className="rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
            {pick("方法说明", "Methodology")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(toggleLanguage(language))}
            className="flex h-10 min-w-16 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-2 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:border-cyan-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30"
            aria-label={language === "zh-CN" ? "Switch to English" : "切换到中文"}
            title={language === "zh-CN" ? "Switch to English" : "切换到中文"}
          >
            <Languages className="size-[17px]" aria-hidden="true" />
            <span className="text-xs font-semibold">{language === "zh-CN" ? "EN" : "中文"}</span>
          </button>
          <Link href="/#tools" className="hidden size-10 place-items-center rounded-lg border border-white/15 text-zinc-400 transition hover:bg-white/5 hover:text-white sm:grid" aria-label={pick("搜索工具", "Search tools")}><Search className="size-[18px]" /></Link>
          <Link href="/methodology" className="hidden size-10 place-items-center rounded-lg border border-white/15 text-zinc-400 transition hover:bg-white/5 hover:text-white sm:grid" aria-label={pick("查看方法说明", "View methodology")}><CircleHelp className="size-[18px]" /></Link>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? pick("关闭菜单", "Close menu") : pick("打开菜单", "Open menu")}>{open ? <X /> : <Menu />}</Button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-white/10 px-4 py-4 lg:hidden" aria-label={pick("移动端导航", "Mobile navigation")}>
          <div className="mx-auto grid max-w-[1440px] gap-1 sm:grid-cols-2">
            {[...primaryTools, ...utilityTools].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/8"
              >
                {language === "en" ? item.titleEn : item.title}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  )
}
