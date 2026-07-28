import type { Metadata } from "next"
import { FileText } from "lucide-react"

import { PdfTool } from "@/components/pdf-tool"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "PDF 批量处理：合并、拆分、排序、压缩与转换",
  description: "一次添加多个 PDF，合并、拆分、调整页面顺序、旋转、删除或提取，也能加页码水印、压缩、转图片和由图片生成 PDF。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "PDF 批量处理", en: "Batch PDF Processing" }}
    description={{
      zh: "一次添加多个 PDF，每页都能看大图并调整顺序、旋转、删除或提取；还能合并拆分、加页码水印、压缩、PDF 转图片和图片转 PDF。",
      en: "Break multiple PDFs into inspectable pages, rebuild them in one assembly, then standardize paper size, numbering, watermarks, and compression before export. Image conversion is also available.",
    }}
    eyebrow="ON-DEVICE BATCH PDF PROCESSING"
    icon={FileText}
    compactHero
    processingLabel={{ zh: "在浏览器中处理", en: "Runs locally in the background" }}
  ><PdfTool /></ToolShell>
}
