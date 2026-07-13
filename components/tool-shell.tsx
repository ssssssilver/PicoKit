import type { LucideIcon } from "lucide-react"
import { Cpu, LockKeyhole, WifiOff } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function ToolShell({
  title,
  description,
  eyebrow,
  icon: Icon,
  children,
  aside,
}: {
  title: string
  description: string
  eyebrow: string
  icon: LucideIcon
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <SiteHeader />
      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
              <Icon className="size-3.5" /> {eyebrow}
            </Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><LockKeyhole className="size-3.5" /> 不上传内容</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><Cpu className="size-3.5" /> 使用本机 CPU/GPU</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><WifiOff className="size-3.5" /> 缓存后可离线</span>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 lg:py-12">
          <div className="min-w-0">{children}</div>
          {aside ? <aside className="space-y-5">{aside}</aside> : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

