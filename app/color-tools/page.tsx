import type { Metadata } from "next"
import { Palette } from "lucide-react"

import { ColorTool } from "@/components/color-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "图片取色、调色板与颜色对比度工具", description: "本地提取图片调色板，转换 HEX、RGB、HSL，并检查 WCAG 文字对比度。" }
export default function Page() { return <ToolShell title={{ zh: "颜色、调色板与对比度工具", en: "Color, Palette, and Contrast Tools" }} description={{ zh: "转换 HEX、RGB、HSL，检查 WCAG 对比度，并从本地图片提取主要颜色。", en: "Convert HEX, RGB, and HSL, check WCAG contrast, and extract dominant colors from a local image." }} eyebrow="Local Color Toolkit" icon={Palette} aside={<ToolAside notes={[{ zh: "图片只通过 Canvas 采样", en: "Images are sampled only through Canvas" }, { zh: "屏幕取色取决于浏览器支持", en: "Screen picking depends on browser support" }, { zh: "对比度结果按 WCAG 公式计算", en: "Contrast uses the WCAG formula" }]} />}><ColorTool /></ToolShell> }
