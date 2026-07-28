import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

import { GeminiWatermarkTool } from "@/components/gemini-watermark-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 AI 图片水印去除｜Gemini、豆包、即梦",
  description: "自动识别并去除 Gemini、豆包、即梦等生成图片上的可见角标，也支持手动框选水印区域；图片不上传。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "AI 图片水印去除", en: "Visible AI Watermark Tool" }}
    description={{
      zh: "自动识别并去除 Gemini、豆包和即梦生成图片上的可见角标；没有识别到时，也可以手动框选水印区域。图片只在当前浏览器中处理。",
      en: "Detect visible marks on Gemini, Doubao, and Jimeng images, or select a region manually. All pixel processing stays in this browser.",
    }}
    eyebrow="VISIBLE AI MARKS · ON DEVICE"
    icon={Sparkles}
    aside={<ToolAside notes={[
      { zh: "支持 Gemini、豆包与即梦可见角标", en: "Supports visible Gemini, Doubao, and Jimeng marks" },
      { zh: "没有识别到水印时不会自动修改图片", en: "Leaves the image unchanged when detection is uncertain" },
      { zh: "水印被压缩或位置变化时可手动框选", en: "Manual selection helps with compressed or shifted marks" },
      { zh: "不处理第三方版权水印或不可见水印", en: "Does not target copyright or invisible watermarks" },
    ]} />}
  ><GeminiWatermarkTool /></ToolShell>
}
