import Link from "next/link"
import { Cpu, LockKeyhole } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <LockKeyhole className="size-4 text-cyan-700" />
            文件留在你的设备上
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            LocalProof 不接收原始文本、图片、Canvas 像素或处理结果。模型与代码会下载到浏览器，计算由你的 CPU/GPU 完成。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600 sm:grid-cols-4">
          <Link href="/methodology" className="hover:text-slate-950">方法</Link>
          <Link href="/privacy" className="hover:text-slate-950">隐私</Link>
          <Link href="/licenses" className="hover:text-slate-950">许可证</Link>
          <Link href="/terms" className="hover:text-slate-950">条款</Link>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Cpu className="size-3.5" /> 免费 · 免登录 · 本地处理</span>
      </div>
    </footer>
  )
}

