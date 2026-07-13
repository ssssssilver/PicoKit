import type { ReactNode } from "react"

import { Localized } from "@/components/localized"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import type { LocalizedValue } from "@/lib/i18n"

export function ContentPage({ eyebrow, title, intro, children }: { eyebrow: string; title: LocalizedValue; intro: LocalizedValue; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <main>
        <header className="border-b border-white/10 bg-[#0b0b0b]"><div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 lg:py-20"><p className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-cyan-300">{eyebrow}</p><h1 className="mt-4 text-4xl font-bold tracking-[-.045em] text-white sm:text-5xl"><LocalizedValueText value={title} /></h1><p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400"><LocalizedValueText value={intro} /></p></div></header>
        <article className="mx-auto max-w-4xl space-y-10 px-5 py-12 text-zinc-400 sm:px-8 lg:py-16 [&_a]:font-medium [&_a]:text-cyan-300 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_li]:leading-7 [&_p]:leading-7 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">{children}</article>
      </main>
      <SiteFooter />
    </div>
  )
}

function LocalizedValueText({ value }: { value: LocalizedValue }) {
  return typeof value === "string" ? value : <Localized zh={value.zh} en={value.en} />
}
