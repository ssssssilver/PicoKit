"use client"

import Link from "next/link"
import { ArrowUpRight, Cpu, LockKeyhole, Mail } from "lucide-react"

import { useLanguage } from "@/components/language-provider"

export function SiteFooter() {
  const { pick } = useLanguage()
  return (
    <footer className="border-t border-white/10 bg-[#080808]">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_380px] lg:gap-16 lg:py-12">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <LockKeyhole className="size-4 text-cyan-300" />
            {pick("文件留在你的设备上", "Files stay on your device")}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            {pick("TabNative 不接收原始文本、图片、文档、音视频、3D 模型、Canvas 像素或处理结果。所需组件在浏览器中运行，计算由你的 CPU/GPU 完成。", "TabNative never receives your source text, images, documents, audio, video, 3D models, canvas pixels, or results. Required components run in the browser, while your CPU/GPU performs the work.")}
          </p>
        </div>
        <div className="border-l border-white/10 pl-5 sm:pl-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Mail className="size-4 text-cyan-300" />
            {pick("反馈与支持", "Feedback & support")}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {pick("遇到问题或希望增加新工具？请告诉我们使用的功能、浏览器和错误提示，无需发送包含隐私的原文件。", "Found a problem or want a new tool? Tell us which feature and browser you used, plus any error message. Do not send private source files.")}
          </p>
          <a href="mailto:modone0622@gmail.com" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
            modone0622@gmail.com <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-5 py-4 text-xs text-zinc-600 sm:px-8 md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-1.5"><Cpu className="size-3.5" /> {pick("免费 · 免登录 · 本地处理", "Free · No account · On-device")}</span>
          <nav aria-label={pick("页尾信息", "Footer information")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/methodology" className="transition hover:text-white">{pick("方法说明", "Method")}</Link>
            <Link href="/privacy" className="transition hover:text-white">{pick("隐私", "Privacy")}</Link>
            <Link href="/licenses" className="transition hover:text-white">{pick("许可证", "Licenses")}</Link>
            <Link href="/terms" className="transition hover:text-white">{pick("条款", "Terms")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
