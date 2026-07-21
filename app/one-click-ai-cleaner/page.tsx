import type { Metadata } from "next"
import { WandSparkles } from "lucide-react"

import { OneClickAiCleanerTool } from "@/components/one-click-ai-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "一键清理图片 AI 痕迹",
  description: "在浏览器本地清理支持的 AI 可见角标与来源字段，并通过重采样、轻量传感器噪声和重新编码优化图像交付。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "一键去 AI 痕迹", en: "One-click AI Trace Cleaner" }}
    description={{
      zh: "清理支持的可见 AI 角标、来源字段，并进行轻量图像交付优化。结果不伪造相机来源，不改变图片的真实创作历史。",
      en: "Clean supported visible AI marks and provenance fields, then apply a light image-delivery normalization. The result does not fabricate a camera origin or change the image's real creation history.",
    }}
    eyebrow="ONE-CLICK AI MARK CLEANUP · ON DEVICE"
    icon={WandSparkles}
    aside={<ToolAside notes={[
      { zh: "支持 Gemini、豆包与即梦可见角标", en: "Supports visible Gemini, Doubao, and Jimeng marks" },
      { zh: "清理 AI 元数据、C2PA 与标签字段", en: "Cleans AI metadata, C2PA, and label fields" },
      { zh: "重采样、轻量传感器噪声与重新编码", en: "Resampling, subtle sensor grain, and re-encoding" },
      { zh: "不伪造相机 EXIF 或来源信息", en: "Does not fabricate camera EXIF or provenance" },
      { zh: "处理前请保留需要的原文件", en: "Keep any source file you may need" },
    ]} />}
  ><OneClickAiCleanerTool /></ToolShell>
}
