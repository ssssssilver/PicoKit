import type { Metadata } from "next"
import { ScanSearch } from "lucide-react"

import { ImageInspectorTool } from "@/components/image-inspector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 图片检测器",
  description: "选择图片后自动检测是否可能由 AI 生成，结果简洁直观；图片不上传，需要时可下载完整 PDF 检测报告。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "AI 图片检测", en: "Free AI Image Detector" }}
    description={{ zh: "选择图片后会自动开始检测，直接告诉你是否可能由 AI 生成。图片不上传，需要详细依据时可下载 PDF 报告。", en: "Choose an image to check whether it was AI-generated. It stays on this device and is never uploaded." }}
    eyebrow="AI Image Detector"
    icon={ScanSearch}
    compactHero
    aside={<ToolAside notes={[
      { zh: "支持 JPEG、PNG、WebP，最大 25MB / 24MP", en: "Supports JPEG, PNG, and WebP up to 25 MB / 24 MP" },
      { zh: "首次准备可能稍慢，之后会更快", en: "First-time setup may take longer; later checks are faster" },
      { zh: "对新模型、插画和重压缩图片可能误判", en: "New generators, illustrations, and heavy compression can be misclassified" },
      { zh: "截图、聊天转发和社交平台重压缩更容易误判，建议优先使用相机原图或未经二次处理的文件", en: "Screenshots, chat forwards, and social-media recompression are more likely to be misclassified; prefer the camera original or an unedited source file" },
    ]} />}
  ><ImageInspectorTool /></ToolShell>
}
