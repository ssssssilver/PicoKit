import type { Metadata } from "next"
import { FileText } from "lucide-react"

import { PdfTool } from "@/components/pdf-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费本地 PDF 页面整理、合并与转换",
  description: "在浏览器本地重排、旋转或删除 PDF 页面，添加页码与文字水印，并完成合并、提取和图片互转。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "PDF 页面整理、合并与转换", en: "Organize, Merge, and Convert PDFs" }}
    description={{
      zh: "重排、逐页旋转或删除页面，添加页码与文字水印，也可合并、按范围处理 PDF 和完成图片互转。所有文件只在当前设备处理。",
      en: "Reorder, rotate, or remove individual pages, add page numbers and text watermarks, merge PDFs, process page ranges, and convert images—all on this device.",
    }}
    eyebrow="Local PDF Toolkit"
    icon={FileText}
    aside={<ToolAside notes={[
      { zh: "页面整理不会修改原始 PDF", en: "Page organization never changes the source PDF" },
      { zh: "页码与文字水印在导出时本地添加", en: "Page numbers and text watermarks are added locally during export" },
      { zh: "建议单个文件不超过 150 MB", en: "Files up to 150 MB are recommended" },
    ]} />}
  ><PdfTool /></ToolShell>
}
