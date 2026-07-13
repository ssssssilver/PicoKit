import type { Metadata } from "next"
import { ScanSearch } from "lucide-react"

import { ImageInspectorTool } from "@/components/image-inspector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "AI 图片来源与 C2PA 检查", description: "本地检查图片的 C2PA Content Credentials、EXIF、XMP、IPTC、AI 生成器和 Made with AI 信号。" }

export default function Page() {
  return <ToolShell title="AI 图片来源与 C2PA 检查" description="读取文件容器里的来源证据：C2PA、EXIF/XMP、DigitalSourceType、生成器软件和工作流参数。没有证据不等于图片一定由真人创作。" eyebrow="Image Provenance" icon={ScanSearch} aside={<ToolAside notes={["首版支持 JPEG、PNG、WebP", "C2PA 验证组件按需加载", "截图和平台重编码常会丢失元数据"]} />}><ImageInspectorTool /></ToolShell>
}

