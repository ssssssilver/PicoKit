import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, ShieldCheck } from "lucide-react"

import { HomeToolDirectory } from "@/components/home-tool-directory"
import { Localized } from "@/components/localized"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { siteConfig } from "@/lib/site"

export const metadata: Metadata = {
  title: "PicoKit — 免费本地 AI Detector 与图片隐私工具",
  description: siteConfig.description,
}

const faq = [
  { question: "文件真的不会上传吗？", questionEn: "Are files really never uploaded?", answer: "不会。文件由浏览器 File API 读取，处理结果通过本地 Blob 下载；服务端不接收原始文本、图片或结果。", answerEn: "No. The browser File API reads files and results download through local Blob URLs. The server never receives the source text, image, or result." },
  { question: "AI 检测分数准确吗？", questionEn: "Are AI detection scores accurate?", answer: "任何检测器都会误判。PicoKit 展示分段证据、稳定度和限制，不把分数描述为作者身份事实。", answerEn: "Every detector produces false positives. PicoKit shows segment evidence, stability, and limits instead of presenting a score as proof of authorship." },
  { question: "清除元数据后就不会显示 Made with AI 吗？", questionEn: "Will removing metadata remove every Made with AI label?", answer: "不保证。平台还可能使用像素分类器、不可见水印或自己的上传历史。", answerEn: "Not guaranteed. Platforms may also use pixel classifiers, invisible watermarks, or their own upload history." },
  { question: "为什么第一次使用较慢？", questionEn: "Why is the first run slower?", answer: "AI 模型需要首次下载到浏览器缓存。后续使用会复用缓存，图片容器工具则无需下载模型。", answerEn: "AI models download to the browser cache on first use. Later visits reuse the cache, while image-container tools do not need a model download." },
]

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PicoKit",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: siteConfig.description,
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <main>
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-[1280px] px-5 pb-8 pt-20 text-center sm:px-8 lg:pb-10 lg:pt-24">
            <h1 className="mx-auto max-w-6xl text-[clamp(3rem,5.5vw,5rem)] font-black leading-[1.02] tracking-[-0.065em] text-white">
              <Localized zh="本地 AI 检测与图片隐私工具" en="On-device AI detection and image privacy tools" />
            </h1>
            <p className="mx-auto mt-10 max-w-2xl text-base leading-7 tracking-[.08em] text-zinc-400 sm:text-xl">
              <Localized zh="文件不上传，计算留在你的设备上" en="No uploads. The work stays on your device." />
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link href="/ai-text-detector" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-7 text-sm font-bold text-[#07111f] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/25">
                <Localized zh="开始检测" en="Start checking" /> <ArrowRight className="size-4" />
              </Link>
              <Link href="/methodology" className="inline-flex h-12 items-center justify-center gap-3 rounded-lg px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/5">
                <Localized zh="了解更多" en="Learn more" /> <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <HomeToolDirectory />

        <section className="border-t border-white/10 bg-[#0d0d0d]">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:py-20">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">Local processing</p>
              <h2 className="mt-4 max-w-lg text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl"><Localized zh="不是云端黑盒，是你设备上的工具箱" en="A toolbox on your device, not a cloud black box" /></h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400"><Localized zh="模型、容器解析和图片编码都在浏览器中运行。广告区域只能读取页面访问，不能读取文件对象、文本输入或 Canvas 像素。" en="Models, container parsing, and image encoding all run in the browser. Ad areas can observe page visits, but cannot access File objects, text input, or canvas pixels." /></p>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              <ProofRow title="无需账号" titleEn="No account" body="打开即可使用，不设置登录墙或按次付费。" bodyEn="Open a tool and use it. No login wall or pay-per-use gate." />
              <ProofRow title="不传文件" titleEn="No uploads" body="原始文本、图片和处理结果都不会进入 PicoKit 服务端。" bodyEn="Source text, images, and results never enter the PicoKit server." />
              <ProofRow title="结果可解释" titleEn="Explainable results" body="展示命中字段、容器证据与限制，不把检测分数包装成事实。" bodyEn="See matched fields, container evidence, and limitations instead of a score presented as fact." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-cyan-300" /><h2 className="text-3xl font-bold tracking-[-.04em] text-white"><Localized zh="常见问题" en="Frequently asked questions" /></h2></div>
          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {faq.map((item) => <div key={item.question} className="grid gap-3 py-6 sm:grid-cols-[240px_1fr]"><h3 className="font-semibold text-zinc-100"><Localized zh={item.question} en={item.questionEn} /></h3><p className="text-sm leading-6 text-zinc-400"><Localized zh={item.answer} en={item.answerEn} /></p></div>)}
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}

function ProofRow({ title, titleEn, body, bodyEn }: { title: string; titleEn: string; body: string; bodyEn: string }) {
  return <div className="grid gap-2 py-5 sm:grid-cols-[150px_1fr]"><h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Check className="size-4 text-cyan-300" /><Localized zh={title} en={titleEn} /></h3><p className="text-sm leading-6 text-zinc-400"><Localized zh={body} en={bodyEn} /></p></div>
}
