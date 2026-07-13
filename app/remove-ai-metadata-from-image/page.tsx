import type { Metadata } from "next"
import { Eraser } from "lucide-react"

import { MetadataCleanerTool } from "@/components/metadata-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费清理图片 AI 元数据", description: "在浏览器本地选择性清理 Stable Diffusion、ComfyUI、Midjourney、Firefly 等 AI 生成器与工作流字段。" }

export default function Page() { return <ToolShell title={{ zh: "清理图片 AI 元数据", en: "Remove AI Metadata from Images" }} description={{ zh: "在不上传文件的情况下移除命中的 AI 生成器、工作流和提示词容器。处理前展示证据，处理后验证像素载荷哈希。", en: "Remove matched AI generator, workflow, and prompt containers without uploading the file. Review evidence before processing and verify the pixel-payload hash afterward." }} eyebrow="AI Metadata Cleaner" icon={Eraser} aside={<ToolAside notes={[{ zh: "默认只针对 AI 相关容器", en: "Targets AI-related containers by default" }, { zh: "下载前会验证像素载荷", en: "Verifies the pixel payload before download" }, { zh: "请先保留需要的原文件", en: "Keep any source file you may need" }]} />}><MetadataCleanerTool mode="ai" /></ToolShell> }
