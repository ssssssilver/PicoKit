import type { Metadata } from "next"
import { FileText } from "lucide-react"

import { PdfTool } from "@/components/pdf-tool"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "PDF 批量处理：合并、拆分、排序、压缩与转换",
  description: "批量导入 PDF，逐页预览、拖拽排序、旋转、删除或提取，并统一设置纸张、页码、水印、压缩和导出。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "PDF 批量处理", en: "Batch PDF Processing" }}
    description={{
      zh: "批量导入多个 PDF，查看每页大图并进行排序、旋转、删除或提取，再统一设置纸张、页码、水印与压缩后导出；也支持图片转 PDF 和 PDF 转图片。",
      en: "Break multiple PDFs into inspectable pages, rebuild them in one assembly, then standardize paper size, numbering, watermarks, and compression before export. Image conversion is also available.",
    }}
    eyebrow="ON-DEVICE BATCH PDF PROCESSING"
    icon={FileText}
    compactHero
    processingLabel={{ zh: "使用本机后台处理", en: "Runs locally in the background" }}
  ><PdfTool /></ToolShell>
}
