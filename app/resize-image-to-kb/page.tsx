import type { Metadata } from "next"
import { Gauge } from "lucide-react"

import { ImageCompressorTool } from "@/components/image-compressor-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费把图片压缩到指定 KB", description: "在浏览器本地把 JPG 或 WebP 压缩到目标文件大小，自动搜索质量与安全缩放组合。" }

export default function Page() { return <ToolShell title="把图片压缩到目标 KB" description="输入目标大小，浏览器会二分搜索 JPG/WebP 质量；必要时逐步缩小尺寸，并说明是否精确达到目标。" eyebrow="Resize Image to KB" icon={Gauge} aside={<ToolAside notes={["目标值以不超过为优先", "PNG 请使用普通压缩工具", "无法精确命中时输出最接近结果"]} />}><ImageCompressorTool targetMode /></ToolShell> }

