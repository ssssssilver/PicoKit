import type { ReactNode } from "react"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function ContentPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <SiteHeader />
      <main>
        <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:py-20"><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-700">{eyebrow}</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{intro}</p></div></header>
        <article className="mx-auto max-w-4xl space-y-10 px-4 py-12 text-slate-700 sm:px-6 lg:py-16 [&_a]:font-medium [&_a]:text-cyan-800 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_h2]:text-slate-950 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-950 [&_li]:leading-7 [&_p]:leading-7 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">{children}</article>
      </main>
      <SiteFooter />
    </div>
  )
}

