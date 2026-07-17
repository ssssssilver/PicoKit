import type { Metadata } from "next"
import { FileCode2 } from "lucide-react"

import { SvgTool } from "@/components/svg-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "SVG 格式化、压缩、安全预览与 PNG 导出", description: "在浏览器中格式化和压缩 SVG，移除脚本与外部链接，安全预览并导出 SVG 或 PNG。" }
export default function Page() { return <ToolShell title={{ zh: "SVG 编辑、压缩与 PNG 导出", en: "Edit, Minify, and Export SVG" }} description={{ zh: "格式化或压缩 SVG 源码，移除危险内容后预览，并按指定尺寸导出 PNG。", en: "Format or minify SVG source, preview it after removing unsafe content, and export a PNG at a chosen size." }} eyebrow="Local SVG Toolkit" icon={FileCode2} aside={<ToolAside notes={[{ zh: "预览会移除脚本和外部链接", en: "Preview removes scripts and external links" }, { zh: "输入文件限制为 2 MB", en: "Input files are limited to 2 MB" }, { zh: "PNG 最大输出宽度为 4096", en: "PNG width is limited to 4096" }]} />}><SvgTool /></ToolShell> }
