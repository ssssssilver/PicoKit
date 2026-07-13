import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

import { GeminiWatermarkTool } from "@/components/gemini-watermark-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 Gemini 可见水印处理", description: "使用开源 SDK 在浏览器本地检测和处理受支持的 Gemini 可见角标，不上传图片。" }

export default function Page() {
  return <ToolShell title={{ zh: "Gemini 可见水印处理", en: "Gemini Visible Watermark Tool" }} description={{ zh: "使用开源 SDK 的已知水印配置与反向 Alpha 混合，处理受支持的 Gemini 生成图片角标。不是生成式重绘，不处理第三方版权水印。", en: "Use known watermark profiles and reverse alpha blending from an open-source SDK to process supported Gemini corner marks. This is not generative repainting and does not remove third-party copyright watermarks." }} eyebrow="Gemini Visible Mark" icon={Sparkles} aside={<ToolAside notes={[{ zh: "只处理受支持的 Gemini 可见角标", en: "Only processes supported visible Gemini marks" }, { zh: "不会移除 SynthID 等不可见水印", en: "Does not remove invisible watermarks such as SynthID" }, { zh: "检测不确定时会安全跳过", en: "Safely skips when detection is uncertain" }]} />}><GeminiWatermarkTool /></ToolShell>
}
