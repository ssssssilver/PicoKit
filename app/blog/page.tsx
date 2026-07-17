import type { Metadata } from "next"
import { ArrowDown, BookOpen, Search, ShieldCheck } from "lucide-react"

import { BlogDirectory } from "@/components/blog-directory"
import { Localized } from "@/components/localized"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { toolGuides, toolGuidesUpdatedAt } from "@/lib/tool-guides"

export const metadata: Metadata = {
  title: "Tool Guides and Tutorials",
  description: "Step-by-step guides for every TabNative browser tool, including preparation, usage, verification, privacy boundaries, and troubleshooting.",
  keywords: ["browser tool guides", "how to compress images", "PDF tutorial", "AI detector guide", "TabNative blog"],
  openGraph: { title: "TabNative Tool Guides", description: "Practical, step-by-step guides for every TabNative on-device tool.", type: "website" },
}

export default function BlogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "TabNative Tool Guides",
    description: metadata.description,
    blogPost: toolGuides.map((guide) => ({ "@type": "BlogPosting", headline: `How to use ${guide.titleEn}`, url: `/blog/${guide.slug}` })),
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <main>
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-[1280px] px-5 pb-14 pt-16 sm:px-8 lg:pb-16 lg:pt-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-cyan-200"><BookOpen className="size-3.5" /> TabNative <Localized zh="教程" en="Guides" /></span><span className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600"><Localized zh="更新于 {date}" en="Updated {date}" values={{ date: toolGuidesUpdatedAt }} /></span></div>
                <h1 className="mt-7 max-w-4xl text-[clamp(3rem,6vw,5.5rem)] font-black leading-[.98] tracking-[-0.065em] text-white"><Localized zh="每个工具，都有一篇清晰教程" en="A clear guide for every tool" /></h1>
                <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg"><Localized zh="从准备文件到下载结果，逐步说明 31 个本地工具的使用方式、结果验证、隐私边界与常见问题。" en="From preparing your file to downloading the result, learn all 31 on-device tools with practical steps, verification checks, privacy boundaries, and troubleshooting." /></p>
                <a href="#guides" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-6 text-sm font-bold text-[#07111f] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25"><Localized zh="查找工具教程" en="Find a tool guide" /><ArrowDown className="size-4" /></a>
              </div>
              <div className="grid border-l border-t border-white/15 sm:grid-cols-3 lg:grid-cols-1">
                <Stat icon={BookOpen} value={String(toolGuides.length)} zh="工具教程" en="tool guides" />
                <Stat icon={Search} value="4" zh="教程章节" en="sections each" />
                <Stat icon={ShieldCheck} value="0" zh="文件上传" en="file uploads" />
              </div>
            </div>
          </div>
        </section>
        <BlogDirectory />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}

function Stat({ icon: Icon, value, zh, en }: { icon: typeof BookOpen; value: string; zh: string; en: string }) {
  return <div className="flex items-center gap-4 border-b border-r border-white/15 p-5"><span className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-cyan-300"><Icon className="size-[18px]" strokeWidth={1.8} /></span><span><strong className="block text-2xl tracking-[-.04em] text-white">{value}</strong><span className="mt-0.5 block text-xs text-zinc-600"><Localized zh={zh} en={en} /></span></span></div>
}
