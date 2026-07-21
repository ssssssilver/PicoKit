import type { Metadata } from "next"
import { WandSparkles } from "lucide-react"

import { OneClickAiCleanerTool } from "@/components/one-click-ai-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "一键清理图片 AI 标记",
  description: "在浏览器本地一次清理支持的 Gemini、豆包、即梦可见角标，以及 AI 元数据、C2PA 和 Made with AI 文件标记。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "一键去 AI 标记", en: "One-click AI Mark Cleaner" }}
    description={{
      zh: "一次清理支持的可见 AI 角标、AI 元数据、C2PA 与 Made with AI 文件标记。它不会改变图片的真实来源，也不承诺绕过像素检测。",
      en: "Clean supported visible AI marks, AI metadata, C2PA, and Made with AI fields in one local workflow. This does not change the image's real origin or promise to bypass pixel detection.",
    }}
    eyebrow="ONE-CLICK AI MARK CLEANUP · ON DEVICE"
    icon={WandSparkles}
    aside={<ToolAside notes={[
      { zh: "支持 Gemini、豆包与即梦可见角标", en: "Supports visible Gemini, Doubao, and Jimeng marks" },
      { zh: "清理 AI 元数据、C2PA 与标签字段", en: "Cleans AI metadata, C2PA, and label fields" },
      { zh: "不会移除 SynthID 等不可见水印", en: "Does not remove invisible watermarks such as SynthID" },
      { zh: "处理前请保留需要的原文件", en: "Keep any source file you may need" },
    ]} />}
  ><OneClickAiCleanerTool /></ToolShell>
}
