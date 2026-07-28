import type { Metadata } from "next"
import { WandSparkles } from "lucide-react"

import { OneClickAiCleanerTool } from "@/components/one-click-ai-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "清理 AI 图片标记与元数据",
  description: "清理支持的 AI 可见角标和相关元数据，再重新编码导出；文件不上传，也不伪造相机信息。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "清理 AI 图片标记", en: "One-click AI Trace Cleaner" }}
    description={{
      zh: "清理支持的可见 AI 角标和图片中的 AI 相关元数据，再重新编码导出。不会伪造相机信息，也不能保证通过所有平台检测。",
      en: "Clean supported visible AI marks and provenance fields, then apply a light image-delivery normalization. The result does not fabricate a camera origin or change the image's real creation history.",
    }}
    eyebrow="ONE-CLICK AI MARK CLEANUP · ON DEVICE"
    icon={WandSparkles}
    aside={<ToolAside notes={[
      { zh: "支持 Gemini、豆包与即梦可见角标", en: "Supports visible Gemini, Doubao, and Jimeng marks" },
      { zh: "清理 AI 元数据、C2PA 与标签字段", en: "Cleans AI metadata, C2PA, and label fields" },
      { zh: "重新采样并导出为新图片", en: "Resampling, subtle sensor grain, and re-encoding" },
      { zh: "不伪造相机 EXIF 或来源信息", en: "Does not fabricate camera EXIF or provenance" },
      { zh: "处理前请保留需要的原文件", en: "Keep any source file you may need" },
    ]} />}
  ><OneClickAiCleanerTool /></ToolShell>
}
