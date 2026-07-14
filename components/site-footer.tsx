"use client"

import Link from "next/link"
import { Cpu, LockKeyhole } from "lucide-react"

import { useLanguage } from "@/components/language-provider"

export function SiteFooter() {
  const { pick } = useLanguage()
  return (
    <footer className="border-t border-white/10 bg-[#080808]">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <LockKeyhole className="size-4 text-cyan-300" />
            {pick("文件留在你的设备上", "Files stay on your device")}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            {pick("PicoKit 不接收原始文本、图片、Canvas 像素或处理结果。所需组件在浏览器中运行，计算由你的 CPU/GPU 完成。", "PicoKit never receives your source text, images, canvas pixels, or results. Required components run in the browser, while your CPU/GPU performs the work.")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-zinc-500 sm:grid-cols-4">
          <Link href="/methodology" className="hover:text-white">{pick("方法", "Method")}</Link>
          <Link href="/privacy" className="hover:text-white">{pick("隐私", "Privacy")}</Link>
          <Link href="/licenses" className="hover:text-white">{pick("许可证", "Licenses")}</Link>
          <Link href="/terms" className="hover:text-white">{pick("条款", "Terms")}</Link>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5"><Cpu className="size-3.5" /> {pick("免费 · 免登录 · 本地处理", "Free · No account · On-device")}</span>
      </div>
    </footer>
  )
}
