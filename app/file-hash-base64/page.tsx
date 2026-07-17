import type { Metadata } from "next"
import { FileKey2 } from "lucide-react"

import { FileCodecTool } from "@/components/file-codec-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费文件 SHA-256、MD5 与 Base64 工具", description: "在浏览器本地计算文件 SHA-256、SHA-1、MD5，并完成文件与 Base64 互转。" }
export default function Page() { return <ToolShell title={{ zh: "文件校验与 Base64 转换", en: "File Checksums and Base64" }} description={{ zh: "计算 SHA-256、SHA-1、MD5 校验值，或在文件与 Base64/Data URL 之间转换。", en: "Calculate SHA-256, SHA-1, and MD5 checksums, or convert files to and from Base64/Data URLs." }} eyebrow="Local File Inspector" icon={FileKey2} aside={<ToolAside notes={[{ zh: "默认推荐使用 SHA-256", en: "SHA-256 is recommended by default" }, { zh: "MD5 只适合兼容校验", en: "MD5 is provided for compatibility only" }, { zh: "Base64 转换限制为 50 MB", en: "Base64 conversion is limited to 50 MB" }]} />}><FileCodecTool /></ToolShell> }
