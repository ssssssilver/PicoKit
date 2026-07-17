import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

import { GeminiWatermarkTool } from "@/components/gemini-watermark-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 可见水印处理｜Gemini、豆包、即梦",
  description: "在浏览器本地检测和处理 Gemini、豆包与即梦生成图片上的可见 AI 角标，并支持手动框选修复，不上传图片。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "AI 可见水印处理", en: "Visible AI Watermark Tool" }}
    description={{
      zh: "自动识别 Gemini、豆包和即梦生成图片上的可见角标，或手动框选需要修复的区域。所有像素处理都在当前浏览器完成。",
      en: "Detect visible marks on Gemini, Doubao, and Jimeng images, or select a region manually. All pixel processing stays in this browser.",
    }}
    eyebrow="VISIBLE AI MARKS · ON DEVICE"
    icon={Sparkles}
    aside={<ToolAside notes={[
      { zh: "支持 Gemini、豆包与即梦可见角标", en: "Supports visible Gemini, Doubao, and Jimeng marks" },
      { zh: "识别不确定时不修改图片", en: "Leaves the image unchanged when detection is uncertain" },
      { zh: "手动框选适合压缩或位置变化的图片", en: "Manual selection helps with compressed or shifted marks" },
      { zh: "不处理第三方版权水印或不可见水印", en: "Does not target copyright or invisible watermarks" },
    ]} />}
  ><GeminiWatermarkTool /></ToolShell>
}
