import type { Metadata } from "next"
import { FileText } from "lucide-react"

import { PdfTool } from "@/components/pdf-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费本地 PDF 页面整理、合并与转换",
  description: "在统一的浏览器本地工作台中合并多个 PDF，拖拽、多选、旋转、删除或提取页面，并完成图片互转。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "PDF 页面整理、合并与转换", en: "Organize, Merge, and Convert PDFs" }}
    description={{
      zh: "把多个 PDF 加入同一页面工作台，拖拽排序、多选旋转、删除或提取页面，并在后台 Worker 中导出；图片互转仍可独立使用。",
      en: "Add multiple PDFs to one page workspace, drag to reorder, batch-rotate, remove, or extract pages, and export in a background Worker. Image conversion remains available separately.",
    }}
    eyebrow="Local PDF Toolkit"
    icon={FileText}
    aside={<ToolAside notes={[
      { zh: "原始 PDF 不会被修改", en: "Source PDFs are never changed" },
      { zh: "缩略图与导出均在后台 Worker 中处理", en: "Thumbnails and exports run in background Workers" },
      { zh: "单个最大 150 MB，整批最大 300 MB", en: "150 MB per file and 300 MB per workspace" },
    ]} />}
  ><PdfTool /></ToolShell>
}
