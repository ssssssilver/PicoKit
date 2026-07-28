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
            {pick("文件不上传，隐私更放心", "Files stay on your device")}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            {pick("图片、PDF、音视频等文件都在你的浏览器里处理。TabNative 不会读取或保存原文件和处理结果。", "TabNative never receives your source text, images, documents, audio, video, 3D models, canvas pixels, or results. Required components run in the browser, while your CPU/GPU performs the work.")}
          </p>
        </div>
        <div className="border-l border-white/10 pl-5 sm:pl-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Mail className="size-4 text-cyan-300" />
            {pick("反馈与支持", "Feedback & support")}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {pick("用着不顺手，或者想要新工具？欢迎把功能名称、浏览器和报错提示发给我们，请不要发送包含隐私的原文件。", "Found a problem or want a new tool? Tell us which feature and browser you used, plus any error message. Do not send private source files.")}
          </p>
          <a href="mailto:modone0622@gmail.com" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
            modone0622@gmail.com <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-5 py-4 text-xs text-zinc-600 sm:px-8 md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-1.5"><Cpu className="size-3.5" /> {pick("免费使用 · 无需登录 · 文件不上传", "Free · No account · On-device")}</span>
          <nav aria-label={pick("页尾信息", "Footer information")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/methodology" className="transition hover:text-white">{pick("检测说明", "Method")}</Link>
            <Link href="/privacy" className="transition hover:text-white">{pick("隐私说明", "Privacy")}</Link>
            <Link href="/licenses" className="transition hover:text-white">{pick("许可证", "Licenses")}</Link>
            <Link href="/terms" className="transition hover:text-white">{pick("条款", "Terms")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
