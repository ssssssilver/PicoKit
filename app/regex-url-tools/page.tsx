import type { Metadata } from "next"
import { Regex } from "lucide-react"

import { RegexUrlTool } from "@/components/regex-url-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "正则测试、URL 编解码与参数解析", description: "在独立 Worker 中测试正则表达式，并完成 URL 编解码和查询参数解析。" }
export default function Page() { return <ToolShell title={{ zh: "正则表达式与 URL 工具", en: "Regex and URL Tools" }} description={{ zh: "安全测试正则匹配与替换，完成 URL 编解码，并拆解路径、Hash 和查询参数。", en: "Safely test regex matches and replacements, encode or decode URLs, and inspect paths, hashes, and query parameters." }} eyebrow="Local Regex & URL Toolkit" icon={Regex} aside={<ToolAside notes={[{ zh: "正则在限时 Worker 中运行", en: "Regex runs in a time-limited Worker" }, { zh: "最多返回前 200 个匹配", en: "Up to 200 matches are returned" }, { zh: "不会请求输入的 URL", en: "Entered URLs are never requested" }]} />}><RegexUrlTool /></ToolShell> }
