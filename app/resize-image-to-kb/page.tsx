import type { Metadata } from "next"
import { Gauge } from "lucide-react"

import { ImageCompressorTool } from "@/components/image-compressor-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费把图片压缩到指定 KB", description: "在浏览器本地把 JPG 或 WebP 压缩到目标文件大小，自动搜索质量与安全缩放组合。" }

export default function Page() { return <ToolShell title={{ zh: "把图片压缩到目标大小", en: "Compress an Image to a Target File Size" }} description={{ zh: "输入目标文件大小，浏览器会搜索合适的 JPG/WebP 质量；必要时逐步缩小尺寸，并说明是否达到目标。", en: "Enter a target file size and the browser will find a suitable JPG/WebP quality, reducing the image dimensions when necessary and reporting whether the target was reached." }} eyebrow="Target-size Image Compressor" icon={Gauge} aside={<ToolAside notes={[{ zh: "优先确保结果不超过目标大小", en: "Staying under the target size takes priority" }, { zh: "PNG 请使用普通压缩工具", en: "Use the standard compressor for PNG" }, { zh: "无法精确命中时输出最接近结果", en: "Outputs the closest result when an exact target is impossible" }]} />}><ImageCompressorTool targetMode /></ToolShell> }
