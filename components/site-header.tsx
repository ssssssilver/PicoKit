"use client"

import Link from "next/link"
import { Menu, ShieldCheck, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { primaryTools, utilityTools } from "@/lib/site"

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111f]/88 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="LocalProof 首页">
          <span className="grid size-9 place-items-center rounded-xl bg-cyan-300 text-[#07111f] shadow-[0_0_28px_rgba(103,232,249,.22)]">
            <ShieldCheck className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-semibold tracking-[-0.03em]">LocalProof</span>
          <span className="hidden rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:inline">
            on-device
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="主导航">
          {primaryTools.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8 hover:text-white">
              {item.title}
            </Link>
          ))}
          <Link href="/image-compressor" className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8 hover:text-white">
            图片工具
          </Link>
          <Link href="/methodology" className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8 hover:text-white">
            方法说明
          </Link>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "关闭菜单" : "打开菜单"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open ? (
        <nav className="border-t border-white/10 px-4 py-4 lg:hidden" aria-label="移动端导航">
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {[...primaryTools, ...utilityTools].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/8"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  )
}

