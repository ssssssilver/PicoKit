import type { Metadata } from "next"
import { FileCode2 } from "lucide-react"

import { MarkdownTool } from "@/components/markdown-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 Markdown 编辑器与 HTML 转换", description: "在浏览器本地编辑和预览 Markdown，安全清理 HTML 并导出 MD 或 HTML。" }
export default function Page() { return <ToolShell title={{ zh: "Markdown 编辑、预览与导出", en: "Edit, Preview, and Export Markdown" }} description={{ zh: "实时预览 GitHub 风格 Markdown，复制经过安全清理的 HTML，并导出 MD 或 HTML 文件。", en: "Preview GitHub-style Markdown, copy sanitized HTML, and export Markdown or HTML files." }} eyebrow="Local Markdown Editor" icon={FileCode2} aside={<ToolAside notes={[{ zh: "预览 HTML 会经过安全清理", en: "Preview HTML is sanitized" }, { zh: "支持表格、任务列表与代码块", en: "Tables, task lists, and code blocks are supported" }, { zh: "内容不会写入云端", en: "Content is never written to the cloud" }]} />}><MarkdownTool /></ToolShell> }
