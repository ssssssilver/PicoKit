import type { Metadata } from "next"
import { ImageIcon } from "lucide-react"

import { QuickImageEditor } from "@/components/quick-image-editor"
import { ImageWorkflowNav } from "@/components/image-workflow-nav"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费批量快速修图、标注与打码",
  description: "在浏览器本地加入多张 JPG、PNG、WebP，点选队列图片逐张裁剪、旋转、调色、标注和打码，保存后统一下载。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "快速修图、标注与打码", en: "Quick Image Editing, Annotation, and Redaction" }}
    description={{ zh: "一次加入多张图片，点击队列项逐张裁剪、调色、标注、绘画和打码，保存结果后继续下一张；图片不会上传。", en: "Add multiple images, select each queue item to crop, tune, annotate, draw, and pixelate it, save the result, then continue to the next without uploading files." }}
    eyebrow="Local Quick Image Editor"
    icon={ImageIcon}
    aside={<ToolAside notes={[
      { zh: "最多加入 30 张 JPG、PNG 或 WebP", en: "Queue up to 30 JPG, PNG, or WebP images" },
      { zh: "点击队列缩略图切换当前编辑图片", en: "Select a queue thumbnail to switch the active image" },
      { zh: "编辑器按页面动态加载", en: "The editor loads only on this page" },
      { zh: "重新编码通常会移除原始元数据", en: "Re-encoding usually removes original metadata" },
    ]} />}
  ><ImageWorkflowNav active="edit" /><QuickImageEditor /></ToolShell>
}
