import type { Metadata } from "next"
import { ScanSearch } from "lucide-react"

import { ImageInspectorTool } from "@/components/image-inspector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 图片检测与来源证据报告",
  description: "在浏览器本地用按需两级像素检测，并分通道检查可见平台标记、C2PA、EXIF、XMP 与生成器来源证据。图片不上传。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "AI 图片来源证据检查", en: "AI Image Provenance Check" }}
    description={{ zh: "分别检查可验证的文件来源、可见平台标记与按需两级像素估计。增强检测会自动复核不确定或偏低的快速结果；全部过程在浏览器中完成。", en: "Inspect verifiable file provenance, visible platform marks, and an on-demand two-stage pixel estimate. An enhanced check automatically reviews uncertain or low fast-check results, entirely in your browser." }}
    eyebrow="AI Image Provenance"
    icon={ScanSearch}
    compactHero
    aside={<ToolAside notes={[
      { zh: "支持 JPEG、PNG、WebP，最大 25MB / 24MP", en: "Supports JPEG, PNG, and WebP up to 25 MB / 24 MP" },
      { zh: "首次准备可能稍慢，之后会更快", en: "First-time setup may take longer; later checks are faster" },
      { zh: "对新模型、插画和重压缩图片可能误判", en: "New generators, illustrations, and heavy compression can be misclassified" },
    ]} />}
  ><ImageInspectorTool /></ToolShell>
}
