import type { Metadata } from "next"
import { ScanSearch } from "lucide-react"

import { ImageInspectorTool } from "@/components/image-inspector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 图片检测与来源检查",
  description: "在浏览器本地分析 AI 图片特征，并检查 C2PA、EXIF、XMP 和生成器来源信号。图片不上传。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "免费 AI 图片检测", en: "Free AI Image Detector" }}
    description={{ zh: "同时分析画面生成特征与文件来源证据。检测在你的浏览器中完成，图片不会上传；结果是风险提示，不是绝对真伪结论。", en: "Analyze generation patterns and file-provenance evidence together. Detection runs in your browser and the image is never uploaded; results are risk signals, not an absolute verdict." }}
    eyebrow="AI Image Detector"
    icon={ScanSearch}
    aside={<ToolAside notes={[
      { zh: "支持 JPEG、PNG、WebP，最大 25MB", en: "Supports JPEG, PNG, and WebP up to 25 MB" },
      { zh: "首次准备可能稍慢，之后会更快", en: "First-time setup may take longer; later checks are faster" },
      { zh: "对新模型、插画和重压缩图片可能误判", en: "New generators, illustrations, and heavy compression can be misclassified" },
    ]} />}
  ><ImageInspectorTool /></ToolShell>
}
