import type { Metadata } from "next"
import { FileText } from "lucide-react"

import { PdfTool } from "@/components/pdf-tool"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "本地 PDF 页面装配台：重组、合并、拆分与转换",
  description: "把多个 PDF 汇入同一浏览器本地装配台，逐页查看、拖拽重排、批量旋转、删除或提取，并统一纸张、页码、水印、压缩和导出。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "PDF 页面装配台", en: "PDF Page Assembly" }}
    description={{
      zh: "把多个 PDF 拆成可查看大图的页面，在同一装配台重排、旋转、删除或提取，再统一纸张、页码、水印与压缩并导出；图片互转也可直接使用。",
      en: "Break multiple PDFs into inspectable pages, rebuild them in one assembly, then standardize paper size, numbering, watermarks, and compression before export. Image conversion is also available.",
    }}
    eyebrow="On-device PDF Assembly"
    icon={FileText}
    compactHero
    processingLabel={{ zh: "使用本机后台处理", en: "Runs locally in the background" }}
  ><PdfTool /></ToolShell>
}
