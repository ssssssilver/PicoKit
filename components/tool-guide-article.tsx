"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, Info, ShieldCheck, Wrench } from "lucide-react"

import { useLanguage } from "@/components/language-provider"
import { getRelatedToolGuides, getToolGuide, toolGuidesUpdatedAt } from "@/lib/tool-guides"

export function ToolGuideArticle({ slug }: { slug: string }) {
  const { pick, format } = useLanguage()
  const guide = getToolGuide(slug)
  if (!guide) return null
  const related = getRelatedToolGuides(guide)

  return (
    <main>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-[1100px] px-5 pb-12 pt-10 sm:px-8 lg:pb-16 lg:pt-14">
          <nav className="flex flex-wrap items-center gap-2 text-xs text-zinc-600" aria-label={pick("面包屑", "Breadcrumb")}>
            <Link href="/blog" className="transition hover:text-cyan-300">{pick("教程", "Guides")}</Link><span>/</span><span>{pick(guide.categoryTitle, guide.categoryTitleEn)}</span><span>/</span><span className="text-zinc-400">{pick(guide.title, guide.titleEn)}</span>
          </nav>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-9 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">{pick("工具使用教程", "Tool guide")}</p>
              <h1 className="mt-5 max-w-4xl text-[clamp(2.5rem,5.5vw,4.75rem)] font-black leading-[1] tracking-[-0.06em] text-white">{format("如何使用{name}", "How to use {name}", { name: pick(guide.title, guide.titleEn) })}</h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">{pick(guide.description, guide.descriptionEn)}</p>
            </div>
            <div className="border-l border-t border-white/15">
              <Meta icon={Clock3} value={`${guide.readMinutes} ${pick("分钟", "minutes")}`} label={pick("预计阅读", "Estimated read")} />
              <Meta icon={Wrench} value={pick(guide.title, guide.titleEn)} label={pick("对应工具", "Tool covered")} />
              <Meta icon={ShieldCheck} value={pick("设备端处理", "On-device")} label={pick("隐私方式", "Privacy model")} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_250px] lg:py-16">
        <article className="min-w-0 space-y-14">
          <section id="before-you-start" className="scroll-mt-28">
            <SectionHeading number="01" title={pick("开始前准备", "Before you start")} />
            <div className="mt-6 border-l border-t border-white/15">
              {guide.prerequisites.map((item, index) => <div key={index} className="flex gap-3 border-b border-r border-white/15 p-4 text-sm leading-6 text-zinc-400 sm:p-5"><Info className="mt-0.5 size-4 shrink-0 text-cyan-300" /><span>{pick(item.zh, item.en)}</span></div>)}
            </div>
          </section>

          <section id="steps" className="scroll-mt-28">
            <SectionHeading number="02" title={pick("分步操作", "Step-by-step")} />
            <ol className="mt-6 space-y-4">
              {guide.steps.map((item, index) => (
                <li key={item.titleEn} className="grid gap-4 border border-white/15 bg-white/[.015] p-5 sm:grid-cols-[44px_1fr] sm:p-6">
                  <span className="grid size-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/[.07] font-mono text-xs font-bold text-cyan-200">{String(index + 1).padStart(2, "0")}</span>
                  <div><h2 className="text-lg font-semibold tracking-[-.02em] text-zinc-100">{pick(item.titleZh, item.titleEn)}</h2><p className="mt-2 text-sm leading-7 text-zinc-500">{pick(item.zh, item.en)}</p></div>
                </li>
              ))}
            </ol>
          </section>

          <section id="verify" className="scroll-mt-28">
            <SectionHeading number="03" title={pick("如何验证结果", "Verify the result")} />
            <div className="mt-6 space-y-3">
              {guide.verification.map((item, index) => <div key={index} className="flex gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[.04] p-4 text-sm leading-6 text-zinc-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" /><span>{pick(item.zh, item.en)}</span></div>)}
            </div>
          </section>

          <section id="troubleshooting" className="scroll-mt-28">
            <SectionHeading number="04" title={pick("常见问题与排错", "Troubleshooting")} />
            <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
              {guide.troubleshooting.map((item, index) => <div key={index} className="grid gap-2 py-5 sm:grid-cols-[32px_1fr]"><span className="font-mono text-xs text-amber-300">{String(index + 1).padStart(2, "0")}</span><p className="text-sm leading-7 text-zinc-500">{pick(item.zh, item.en)}</p></div>)}
            </div>
          </section>

          <section className="border border-cyan-300/20 bg-cyan-300/[.035] p-6 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">{pick("现在开始", "Try it now")}</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-.035em] text-white">{format("打开{name}", "Open {name}", { name: pick(guide.title, guide.titleEn) })}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">{pick("原文件和处理结果留在当前设备。关闭页面前请下载需要保留的结果。", "Source files and results stay on this device. Download anything you want to keep before closing the page.")}</p>
            <Link href={guide.href} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-300 px-5 text-sm font-bold text-[#07111f] transition hover:bg-cyan-200">{pick("打开工具", "Open tool")}<ExternalLink className="size-4" /></Link>
          </section>
        </article>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-white/10 bg-[#0d0d0d] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-zinc-600">{pick("本页内容", "On this page")}</p>
            <nav className="mt-4 grid gap-1 text-sm">
              <a href="#before-you-start" className="rounded px-2 py-2 text-zinc-500 hover:bg-white/5 hover:text-white">01 · {pick("开始前准备", "Before you start")}</a>
              <a href="#steps" className="rounded px-2 py-2 text-zinc-500 hover:bg-white/5 hover:text-white">02 · {pick("分步操作", "Step-by-step")}</a>
              <a href="#verify" className="rounded px-2 py-2 text-zinc-500 hover:bg-white/5 hover:text-white">03 · {pick("验证结果", "Verify result")}</a>
              <a href="#troubleshooting" className="rounded px-2 py-2 text-zinc-500 hover:bg-white/5 hover:text-white">04 · {pick("排错", "Troubleshooting")}</a>
            </nav>
            <div className="mt-5 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-600">{pick("更新于", "Updated")} {toolGuidesUpdatedAt}</div>
          </div>
        </aside>
      </div>

      {related.length ? (
        <section className="border-t border-white/10 bg-[#0b0b0b]">
          <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-8 lg:py-14">
            <div className="flex items-end justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">{pick("继续阅读", "Keep learning")}</p><h2 className="mt-2 text-2xl font-bold text-white">{pick("相关工具教程", "Related tool guides")}</h2></div><Link href="/blog" className="hidden items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 sm:flex">{pick("全部教程", "All guides")}<ArrowRight className="size-4" /></Link></div>
            <div className="mt-7 grid border-l border-t border-white/15 md:grid-cols-3">{related.map((item) => <Link key={item.slug} href={`/blog/${item.slug}`} className="group min-h-44 border-b border-r border-white/15 p-5 transition hover:bg-white/[.035]"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-zinc-600">{pick(item.categoryTitle, item.categoryTitleEn)}</span><strong className="mt-3 block text-base text-zinc-200 group-hover:text-cyan-200">{format("如何使用{name}", "How to use {name}", { name: pick(item.title, item.titleEn) })}</strong><span className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-600 group-hover:text-zinc-300">{item.readMinutes} {pick("分钟", "min")}<ArrowRight className="size-3.5" /></span></Link>)}</div>
            <Link href="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 sm:hidden"><ArrowLeft className="size-4" />{pick("返回全部教程", "Back to all guides")}</Link>
          </div>
        </section>
      ) : null}
    </main>
  )
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return <div className="flex items-center gap-4 border-b border-white/10 pb-4"><span className="font-mono text-xs text-cyan-300">{number}</span><h2 className="text-2xl font-bold tracking-[-.035em] text-white">{title}</h2></div>
}

function Meta({ icon: Icon, value, label }: { icon: typeof Clock3; value: string; label: string }) {
  return <div className="flex items-center gap-3 border-b border-r border-white/15 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-cyan-300"><Icon className="size-4" /></span><span className="min-w-0"><strong className="block truncate text-sm text-zinc-200">{value}</strong><span className="mt-0.5 block text-[11px] text-zinc-600">{label}</span></span></div>
}
