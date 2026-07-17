import type { Metadata } from "next"
import { ScanSearch } from "lucide-react"

import { ImageInspectorTool } from "@/components/image-inspector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 图片检测与来源证据报告",
  description: "在浏览器本地分通道检查像素模型、可见平台标记、C2PA、EXIF、XMP 与生成器来源证据。图片不上传。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "AI 图片来源证据检查", en: "AI Image Provenance Check" }}
    description={{ zh: "分别检查可验证的文件来源、可见平台标记与像素模型估计。检测在浏览器中完成，结果用于理解证据与限制，不是绝对真伪结论。", en: "Inspect verifiable file provenance, visible platform marks, and pixel-model estimates separately. Checks run in your browser and explain evidence and limits rather than issuing an absolute verdict." }}
    eyebrow="AI Image Provenance"
    icon={ScanSearch}
    aside={<ToolAside notes={[
      { zh: "支持 JPEG、PNG、WebP，最大 25MB / 24MP", en: "Supports JPEG, PNG, and WebP up to 25 MB / 24 MP" },
      { zh: "首次准备可能稍慢，之后会更快", en: "First-time setup may take longer; later checks are faster" },
      { zh: "对新模型、插画和重压缩图片可能误判", en: "New generators, illustrations, and heavy compression can be misclassified" },
    ]} />}
  ><ImageInspectorTool /></ToolShell>
}
