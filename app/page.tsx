import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Cpu, FileLock2, Gauge, LockKeyhole, ShieldCheck, WifiOff } from "lucide-react"

import { AdSlot } from "@/components/ad-slot"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { primaryTools, siteConfig, utilityTools } from "@/lib/site"

export const metadata: Metadata = {
  title: "LocalProof — 免费本地 AI Detector 与图片隐私工具",
  description: siteConfig.description,
}

const faq = [
  ["文件真的不会上传吗？", "不会。文件由浏览器 File API 读取，处理结果通过本地 Blob 下载；服务端不接收原始文本、图片或结果。"],
  ["AI 检测分数准确吗？", "任何检测器都会误判。LocalProof 展示分段证据、稳定度和限制，不把分数描述为作者身份事实。"],
  ["清除元数据后就不会显示 Made with AI 吗？", "不保证。平台还可能使用像素分类器、不可见水印或自己的上传历史。"],
  ["为什么第一次使用较慢？", "AI 模型需要首次下载到浏览器缓存。后续使用会复用缓存，图片容器工具则无需下载模型。"],
]

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LocalProof",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: siteConfig.description,
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-[#07111f] text-white">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(125,211,252,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.08)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          <div className="absolute -left-36 top-10 size-[420px] rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="absolute -right-32 bottom-0 size-[420px] rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-28">
            <div>
              <Badge className="border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">免费 · 免登录 · 设备端运行</Badge>
              <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl lg:text-7xl">AI 证据留在文件里。<span className="text-cyan-300">检查也该留在本地。</span></h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">检测 AI 文本风险、读取图片来源凭证、处理 Gemini 可见角标，并清理你选择的 AI 元数据。计算使用你的 CPU/GPU，内容不上传。</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/ai-text-detector" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-200">开始检测 <ArrowRight className="size-4" /></Link>
                <Link href="/ai-image-detector" className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10">检查一张图片</Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400"><span className="flex items-center gap-2"><Check className="size-4 text-cyan-300" />无账号墙</span><span className="flex items-center gap-2"><Check className="size-4 text-cyan-300" />无按次付费</span><span className="flex items-center gap-2"><Check className="size-4 text-cyan-300" />开源运行时</span></div>
            </div>
            <div className="self-end rounded-[28px] border border-white/10 bg-white/[.06] p-3 shadow-2xl shadow-black/25 backdrop-blur">
              <div className="rounded-[22px] border border-white/10 bg-[#0b1728] p-5 sm:p-6">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Local runtime</span><span className="flex items-center gap-2 text-xs text-emerald-300"><span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_12px_currentColor]" />Ready</span></div>
                <div className="mt-8 grid gap-3">
                  <RuntimeRow icon={Cpu} label="模型推理" value="WebGPU / WASM" />
                  <RuntimeRow icon={FileLock2} label="文件传输" value="0 bytes uploaded" />
                  <RuntimeRow icon={Gauge} label="元数据解析" value="Browser Worker" />
                  <RuntimeRow icon={WifiOff} label="模型缓存" value="Browser Cache" />
                </div>
                <div className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300"><LockKeyhole className="mb-3 size-5 text-cyan-300" />广告脚本只能看到页面访问，不能访问文件对象、文本输入或 Canvas 像素。</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-700">Core tools</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">三个入口，回答三个不同问题</h2><p className="mt-4 text-base leading-7 text-slate-600">“像不像 AI”与“文件是否带有 AI 来源证据”不是同一件事。LocalProof 把模型判断、来源凭证和像素处理分开呈现。</p></div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {primaryTools.map((tool, index) => <Link href={tool.href} key={tool.href} className="group"><Card className="h-full border-slate-200 shadow-none transition duration-300 group-hover:-translate-y-1 group-hover:border-cyan-300 group-hover:shadow-xl group-hover:shadow-cyan-900/5"><CardContent className="p-6"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-slate-950 text-cyan-300"><tool.icon /></span><span className="font-mono text-xs text-slate-300">0{index + 1}</span></div><h3 className="mt-8 text-xl font-semibold tracking-[-.03em]">{tool.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{tool.description}</p><span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">打开工具 <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></CardContent></Card></Link>)}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><AdSlot /></div>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-700">Image privacy kit</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">不加载大模型的高频图片工具</h2><p className="mt-4 text-base leading-7 text-slate-600">容器解析、无损元数据重写和 Canvas 编码都在浏览器完成。打开就用，不消耗服务器推理额度。</p></div>
            <div className="grid gap-3 sm:grid-cols-2">{utilityTools.map((tool) => <Link key={tool.href} href={tool.href} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-900/5"><span className="grid size-10 place-items-center rounded-xl bg-cyan-50 text-cyan-800"><tool.icon className="size-5" /></span><span className="flex-1 text-sm font-semibold">{tool.title}</span><ArrowRight className="size-4 text-slate-300" /></Link>)}</div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><ShieldCheck className="size-6 text-cyan-700" /><h2 className="text-3xl font-semibold tracking-[-.04em]">你应该知道的限制</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3"><Limit title="检测不是裁判" body="AI 文本分数是统计证据，不能单独用于学术处罚、招聘或作者身份判断。" /><Limit title="无元数据不是证明" body="截图、平台重编码和清理工具都会删除来源信息；空白结果不代表真人创作。" /><Limit title="标签可能来自像素" body="清除 DigitalSourceType 或 C2PA 不能保证社交平台不再显示 AI 标签。" /></div></div></section>

        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20"><h2 className="text-center text-3xl font-semibold tracking-[-.04em]">常见问题</h2><div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 sm:px-7">{faq.map(([question, answer]) => <div key={question} className="py-6"><h3 className="font-semibold">{question}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{answer}</p></div>)}</div></section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}

function RuntimeRow({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3.5"><Icon className="size-4 text-cyan-300" /><span className="flex-1 text-sm text-slate-300">{label}</span><span className="font-mono text-xs text-white">{value}</span></div> }
function Limit({ title, body }: { title: string; body: string }) { return <div className="rounded-2xl bg-slate-50 p-5"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p></div> }
