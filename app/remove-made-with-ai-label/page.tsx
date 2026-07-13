import type { Metadata } from "next"
import { Tags } from "lucide-react"

import { MetadataCleanerTool } from "@/components/metadata-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "清理 Made with AI 标签信号", description: "本地清理 IPTC/XMP DigitalSourceType、C2PA AI 声明等可能触发 Made with AI 标签的元数据。" }

export default function Page() { return <ToolShell title="清理 “Made with AI” 标签信号" description="检查并选择性移除 DigitalSourceType、C2PA AI 声明等元数据触发信号。平台仍可能使用像素分类器，因此不承诺标签一定消失。" eyebrow="AI Label Signals" icon={Tags} aside={<ToolAside notes={["只处理文件中的元数据触发信号", "平台像素分类器不受影响", "不提供绕过平台检测的承诺"]} />}><MetadataCleanerTool mode="label" /></ToolShell> }

