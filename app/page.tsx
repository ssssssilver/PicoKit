import type { Metadata } from "next"
import { Check, ShieldCheck } from "lucide-react"

import { HomeHeroBanner } from "@/components/home-hero-banner"
import { HomeToolDirectory } from "@/components/home-tool-directory"
import { Localized } from "@/components/localized"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { siteConfig } from "@/lib/site"

export const metadata: Metadata = {
  title: "TabNative — 免费在线工具箱，文件不上传",
  description: siteConfig.description,
}

const faq = [
  { question: "文件真的不会上传吗？", questionEn: "Are files really never uploaded?", answer: "不会。你选择的图片、PDF、音视频和处理结果都只在当前浏览器中使用，TabNative 服务端不会接收或保存这些文件。", answerEn: "No. The browser File API reads files, and results download through local Blob URLs. The server never receives source text, images, documents, audio, video, 3D models, or processing results." },
  { question: "AI 图片检测准不准？", questionEn: "Can AI image detection prove an image's origin?", answer: "检测结果只能作为参考，截图、重度压缩或二次编辑过的图片更容易误判。TabNative 会结合平台标记、图片信息和多次检测给出结果，但不能替代人工核实。", answerEn: "Not from one score alone. TabNative separates file-provenance evidence, visible platform marks, and pixel-model estimates, with unavailable channels and limits clearly identified." },
  { question: "去掉图片信息后，就不会显示 Made with AI 了吗？", questionEn: "Will removing metadata remove every Made with AI label?", answer: "不一定。不同平台还可能根据画面特征、不可见水印或历史上传记录判断，清理元数据不代表能通过所有平台检测。", answerEn: "Not guaranteed. Platforms may also use pixel classifiers, invisible watermarks, or their own upload history." },
  { question: "为什么第一次打开有点慢？", questionEn: "Why is the first run slower?", answer: "个别工具第一次使用时，浏览器需要先准备处理资源。准备完成后会自动缓存，再次打开和处理都会快很多。", answerEn: "Some tools need to prepare local components on first use. Later visits reuse the browser cache for faster startup and processing." },
]

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TabNative",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: siteConfig.description,
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <main>
        <HomeHeroBanner />

        <HomeToolDirectory />

        <section className="border-t border-white/10 bg-[#0d0d0d]">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:py-20">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300"><Localized zh="为什么选 TabNative" en="Batch Image Processing" /></p>
              <h2 className="mt-4 max-w-lg text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl"><Localized zh="文件不用上传，常用处理一次搞定" en="One input, one local path to a finished asset" /></h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400"><Localized zh="批量图片处理可以连续完成去背景、修图、改尺寸、压缩和格式转换；PDF 批量处理可以合并、拆分、调顺序、删页面、加页码水印和压缩。打开网页即可使用，处理完成直接下载。" en="Batch Image Processing covers background removal, edge refinement, per-image editing, and format, dimension, and file-size optimization. Batch PDF Processing covers page previews, reordering, rotation, removal, extraction, merging, splitting, and compression. All files are processed on this device." /></p>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              <ProofRow title="打开就能用" titleEn="No account" body="不用注册账号，也没有按次收费，选择文件后直接开始处理。" bodyEn="Open a tool and use it. No login wall or pay-per-use gate." />
              <ProofRow title="文件不上传" titleEn="No uploads" body="原文件和处理结果只在当前浏览器中使用，服务端不会读取或保存。" bodyEn="Source text, images, documents, audio, video, 3D models, and results never enter the TabNative server." />
              <ProofRow title="批量更省事" titleEn="Connected workflow" body="多张图片、多个 PDF 可以一次添加、连续处理，不用来回上传下载。" bodyEn="Pass a result directly to the next image tool without downloading and uploading it again." />
              <ProofRow title="结果直接下载" titleEn="Layered evidence" body="处理完成后可单独下载，也可批量打包，原文件不会被修改。" bodyEn="Review file provenance, visible marks, and model estimates separately—not one score presented as fact." />
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
