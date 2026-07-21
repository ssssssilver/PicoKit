import type { Metadata } from "next"
import { Check, ShieldCheck } from "lucide-react"

import { HomeHeroBanner } from "@/components/home-hero-banner"
import { HomeToolDirectory } from "@/components/home-tool-directory"
import { Localized } from "@/components/localized"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { siteConfig } from "@/lib/site"

export const metadata: Metadata = {
  title: "TabNative — 批量图片处理与 PDF 批量处理",
  description: siteConfig.description,
}

const faq = [
  { question: "文件真的不会上传吗？", questionEn: "Are files really never uploaded?", answer: "不会。文件由浏览器 File API 读取，处理结果通过本地 Blob 下载；服务端不接收原始文本、图片、文档、音视频、3D 模型或处理结果。", answerEn: "No. The browser File API reads files, and results download through local Blob URLs. The server never receives source text, images, documents, audio, video, 3D models, or processing results." },
  { question: "AI 图片检测能证明图片来源吗？", questionEn: "Can AI image detection prove an image's origin?", answer: "不能只靠一个分数证明。TabNative 会分开显示文件来源证据、可见平台标记和像素模型估计，并注明不可用通道与限制。", answerEn: "Not from one score alone. TabNative separates file-provenance evidence, visible platform marks, and pixel-model estimates, with unavailable channels and limits clearly identified." },
  { question: "清除元数据后就不会显示 Made with AI 吗？", questionEn: "Will removing metadata remove every Made with AI label?", answer: "不保证。平台还可能使用像素分类器、不可见水印或自己的上传历史。", answerEn: "Not guaranteed. Platforms may also use pixel classifiers, invisible watermarks, or their own upload history." },
  { question: "为什么第一次使用较慢？", questionEn: "Why is the first run slower?", answer: "部分工具首次使用时需要准备本地运行组件。后续会复用浏览器缓存，启动和处理都会更快。", answerEn: "Some tools need to prepare local components on first use. Later visits reuse the browser cache for faster startup and processing." },
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
              <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300"><Localized zh="批量图片处理" en="Batch Image Processing" /></p>
              <h2 className="mt-4 max-w-lg text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl"><Localized zh="上传一次，在本地完成整条交付流程" en="One input, one local path to a finished asset" /></h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400"><Localized zh="批量图片处理支持去背景、修边、逐张修图以及格式、尺寸和文件大小优化；PDF 批量处理支持逐页预览、排序、旋转、删除、提取、合并、拆分与压缩。所有文件都在当前设备处理。" en="Batch Image Processing covers background removal, edge refinement, per-image editing, and format, dimension, and file-size optimization. Batch PDF Processing covers page previews, reordering, rotation, removal, extraction, merging, splitting, and compression. All files are processed on this device." /></p>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              <ProofRow title="无需账号" titleEn="No account" body="打开即可使用，不设置登录墙或按次付费。" bodyEn="Open a tool and use it. No login wall or pay-per-use gate." />
              <ProofRow title="不传文件" titleEn="No uploads" body="原始文本、图片、文档、音视频、3D 模型和处理结果都不会进入 TabNative 服务端。" bodyEn="Source text, images, documents, audio, video, 3D models, and results never enter the TabNative server." />
              <ProofRow title="连续完成" titleEn="Connected workflow" body="处理结果可直接进入下一项图片工具，不必下载后重新上传。" bodyEn="Pass a result directly to the next image tool without downloading and uploading it again." />
              <ProofRow title="证据分层" titleEn="Layered evidence" body="分别展示文件来源、可见标记和模型估计，不把一个分数包装成事实。" bodyEn="Review file provenance, visible marks, and model estimates separately—not one score presented as fact." />
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
