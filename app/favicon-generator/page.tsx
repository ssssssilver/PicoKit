import type { Metadata } from "next"
import { ImageIcon } from "lucide-react"

import { FaviconTool } from "@/components/favicon-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 Favicon 与应用图标生成器", description: "从图片本地生成 favicon.ico、Apple Touch Icon、PWA 图标和 Web Manifest。" }
export default function Page() { return <ToolShell title={{ zh: "Favicon 与应用图标生成器", en: "Favicon and App Icon Generator" }} description={{ zh: "从一张图片生成 ICO、常用 PNG 图标、Apple Touch Icon、Web Manifest 和 HTML 引用片段。", en: "Turn one image into an ICO, common PNG icon sizes, an Apple Touch Icon, Web Manifest, and HTML snippet." }} eyebrow="Local Icon Generator" icon={ImageIcon} aside={<ToolAside notes={[{ zh: "ZIP 包含 6 种常用尺寸", en: "The ZIP includes six common sizes" }, { zh: "支持背景色、安全区与圆角预览", en: "Preview background, safe area, and corner radius" }, { zh: "SVG 会在浏览器中栅格化", en: "SVG input is rasterized in the browser" }]} />}><FaviconTool /></ToolShell> }
