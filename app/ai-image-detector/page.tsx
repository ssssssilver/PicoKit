import type { Metadata } from "next"
import { ScanSearch } from "lucide-react"

import { ImageInspectorTool } from "@/components/image-inspector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 图片检测器",
  description: "上传图片后直接判断是否由 AI 生成。检测在浏览器本地完成，图片不会上传；详细依据可按需下载为检测报告。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "AI 图片检测", en: "Free AI Image Detector" }}
    description={{ zh: "选择一张图片，检测它是否由 AI 生成。图片只在当前设备处理，不会上传。", en: "Choose an image to check whether it was AI-generated. It stays on this device and is never uploaded." }}
    eyebrow="AI Image Detector"
    icon={ScanSearch}
    compactHero
    aside={<ToolAside notes={[
      { zh: "支持 JPEG、PNG、WebP，最大 25MB / 24MP", en: "Supports JPEG, PNG, and WebP up to 25 MB / 24 MP" },
      { zh: "首次准备可能稍慢，之后会更快", en: "First-time setup may take longer; later checks are faster" },
      { zh: "对新模型、插画和重压缩图片可能误判", en: "New generators, illustrations, and heavy compression can be misclassified" },
    ]} />}
  ><ImageInspectorTool /></ToolShell>
}
