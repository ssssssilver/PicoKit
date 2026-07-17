import type { Metadata } from "next"
import { ArrowDown, Globe2, ShieldCheck, Sparkles } from "lucide-react"

import { AiToolDirectory } from "@/components/ai-tool-directory"
import { Localized } from "@/components/localized"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { aiDirectoryCategories, aiDirectoryReviewedAt, aiDirectoryTools } from "@/lib/ai-directory"

export const metadata: Metadata = {
  title: "AI Tools Directory by Task",
  description: "Browse AI tools for chat, research, writing, coding, design, video, audio, and automation. Manually reviewed descriptions and official product links.",
  keywords: ["AI tools directory", "AI apps", "AI coding tools", "AI video tools", "AI agents"],
  openGraph: {
    title: "TabNative AI Tools Directory",
    description: "AI products organized by task, with manually reviewed descriptions and official direct links.",
    type: "website",
  },
}

export default function AiToolsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "TabNative AI Tools Directory",
    numberOfItems: aiDirectoryTools.length,
    itemListElement: aiDirectoryTools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.name,
      url: tool.url,
    })),
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <main>
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-[1280px] px-5 pb-14 pt-16 sm:px-8 lg:pb-16 lg:pt-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-cyan-200">
                    <Sparkles className="size-3.5" /> AI tools directory
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600"><Localized zh="复核于 {date}" en="Reviewed {date}" values={{ date: aiDirectoryReviewedAt }} /></span>
                </div>
                <h1 className="mt-7 max-w-4xl text-[clamp(3rem,6vw,5.5rem)] font-black leading-[.98] tracking-[-0.065em] text-white">
                  <Localized zh="按任务查找 AI 工具" en="Find AI tools by task" />
                </h1>
                <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                  <Localized
                    zh="按研究、写作、编程、图像、视频和自动化等任务整理。描述经过人工复核，只提供官方产品入口，不接受付费排名。"
                    en="Organized around research, writing, coding, image, video, and automation tasks. Descriptions are manually reviewed, with official product links and no paid ranking."
                  />
                </p>
                <a href="#directory" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-6 text-sm font-bold text-[#07111f] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25">
                  <Localized zh="浏览全部工具" en="Browse all tools" /> <ArrowDown className="size-4" />
                </a>
              </div>

              <div className="grid border-l border-t border-white/15 sm:grid-cols-3 lg:grid-cols-1">
                <Stat icon={Globe2} value={String(aiDirectoryTools.length)} labelZh="工具入口" labelEn="tool links" />
                <Stat icon={Sparkles} value={String(aiDirectoryCategories.length)} labelZh="任务分类" labelEn="task categories" />
                <Stat icon={ShieldCheck} value="0" labelZh="赞助排名" labelEn="sponsored rankings" />
              </div>
            </div>
          </div>
        </section>

        <AiToolDirectory />

        <section className="border-t border-white/10 bg-[#0d0d0d]">
          <div className="mx-auto grid max-w-[1280px] gap-7 px-5 py-12 sm:px-8 lg:grid-cols-[280px_1fr] lg:py-14">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300"><Localized zh="选择提示" en="Choosing a tool" /></p>
              <h2 className="mt-3 text-2xl font-bold tracking-[-.035em] text-white"><Localized zh="更快找到适合你的 AI 工具" en="Find the right AI tool faster" /></h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500"><Localized zh="先按任务缩小范围，再结合预算、地区和文件类型选择。" en="Start with the task, then choose based on your budget, region, and file type." /></p>
            </div>
            <div className="grid border-l border-t border-white/15 sm:grid-cols-3">
              <Criterion titleZh="按任务选择" titleEn="Choose by task" bodyZh="先选择研究、写作、编程、图像、视频或自动化，再查看适合该任务的产品。" bodyEn="Choose research, writing, coding, image, video, or automation first, then compare tools for that task." />
              <Criterion titleZh="直接查看官方信息" titleEn="Check official details" bodyZh="每个入口都指向产品官方页面。价格、功能和地区可用性可能变化，请在使用前确认。" bodyEn="Every link opens the official product page. Pricing, features, and regional availability can change, so check before use." />
              <Criterion titleZh="排名不代表效果" titleEn="Order is not a ranking" bodyZh="列表不接受付费置顶，排列顺序也不代表效果优劣。请根据自己的内容和需求试用判断。" bodyEn="The list has no paid placement, and its order does not imply quality. Try tools with your own content and requirements." />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}

function Stat({ icon: Icon, value, labelZh, labelEn }: { icon: typeof Globe2; value: string; labelZh: string; labelEn: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-r border-white/15 p-5">
      <span className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-cyan-300"><Icon className="size-[18px]" strokeWidth={1.8} /></span>
      <span><strong className="block text-2xl tracking-[-.04em] text-white">{value}</strong><span className="mt-0.5 block text-xs text-zinc-600"><Localized zh={labelZh} en={labelEn} /></span></span>
    </div>
  )
}

function Criterion({ titleZh, titleEn, bodyZh, bodyEn }: { titleZh: string; titleEn: string; bodyZh: string; bodyEn: string }) {
  return (
    <div className="border-b border-r border-white/15 p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-zinc-100"><Localized zh={titleZh} en={titleEn} /></h3>
      <p className="mt-3 text-sm leading-6 text-zinc-500"><Localized zh={bodyZh} en={bodyEn} /></p>
    </div>
  )
}
