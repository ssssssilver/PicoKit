import type { LucideIcon } from "lucide-react"
import { Cpu, LockKeyhole, WifiOff } from "lucide-react"
import type { ReactNode } from "react"

import { Localized } from "@/components/localized"
import { Badge } from "@/components/ui/badge"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import type { LocalizedValue } from "@/lib/i18n"

export function ToolShell({
  title,
  description,
  eyebrow,
  icon: Icon,
  children,
  aside,
}: {
  title: LocalizedValue
  description: LocalizedValue
  eyebrow: string
  icon: LucideIcon
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <main>
        <section className="border-b border-white/10 bg-[#0b0b0b]">
          <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 lg:py-16">
            <Badge variant="outline" className="border-cyan-300/25 bg-cyan-300/[.06] font-mono text-[10px] uppercase tracking-[.12em] text-cyan-300">
              <Icon className="size-3.5" /> {eyebrow}
            </Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-[-0.045em] text-white sm:text-5xl"><LocalizedValueText value={title} /></h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg"><LocalizedValueText value={description} /></p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-zinc-500">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[.025] px-3 py-1.5"><LockKeyhole className="size-3.5 text-cyan-300" /> <Localized zh="不上传内容" en="No content uploads" /></span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[.025] px-3 py-1.5"><Cpu className="size-3.5 text-cyan-300" /> <Localized zh="使用本机 CPU/GPU" en="Uses local CPU/GPU" /></span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[.025] px-3 py-1.5"><WifiOff className="size-3.5 text-cyan-300" /> <Localized zh="缓存后可离线" en="Works offline after caching" /></span>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1180px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:py-12">
          <div className="min-w-0">{children}</div>
          {aside ? <aside className="space-y-5">{aside}</aside> : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function LocalizedValueText({ value }: { value: LocalizedValue }) {
  return typeof value === "string" ? value : <Localized zh={value.zh} en={value.en} />
}
