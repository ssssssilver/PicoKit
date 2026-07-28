import type { Metadata } from "next"
import { Eraser } from "lucide-react"

import { MetadataCleanerTool } from "@/components/metadata-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费去除图片 AI 元数据", description: "删除 Stable Diffusion、ComfyUI、Midjourney、Firefly 等 AI 生成器、工作流和提示词信息；图片不上传。" }

export default function Page() { return <ToolShell title={{ zh: "去除图片 AI 元数据", en: "Remove AI Metadata from Images" }} description={{ zh: "删除图片中识别到的 AI 生成器、工作流和提示词信息。处理前会列出要删除的内容，处理后会确认画面没有变化。", en: "Remove matched AI generator, workflow, and prompt containers without uploading the file. Review evidence before processing and verify the pixel-payload hash afterward." }} eyebrow="AI Metadata Cleaner" icon={Eraser} aside={<ToolAside notes={[{ zh: "默认只删除 AI 相关信息", en: "Targets AI-related containers by default" }, { zh: "下载前会确认画面没有变化", en: "Verifies the pixel payload before download" }, { zh: "请先保留需要的原文件", en: "Keep any source file you may need" }]} />}><MetadataCleanerTool mode="ai" /></ToolShell> }
