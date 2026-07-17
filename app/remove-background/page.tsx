import type { Metadata } from "next"
import { Scissors } from "lucide-react"

import { BackgroundRemovalBatchStudio } from "@/components/background-removal-batch-studio"
import { ImageWorkflowNav } from "@/components/image-workflow-nav"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费批量移除图片背景",
  description: "在浏览器本地批量移除人物、商品、动物、车辆与家具背景，逐项修正边缘，并把成功队列一键传入批量快速修图。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "移除图片背景", en: "Remove Image Background" }}
    description={{ zh: "一次加入多张图片，在设备端按队列顺序生成透明背景；可直接选中结果手动修边，并将整个成功队列继续交给批量快速修图。", en: "Add multiple images, create transparent backgrounds sequentially on your device, refine any result in the queue, then pass the completed batch directly to quick editing." }}
    eyebrow="On-device RemoveBG"
    icon={Scissors}
    aside={<ToolAside notes={[
      { zh: "自动识别主要主体，无需选择处理模式", en: "Automatically detects the main subject with no processing mode to choose" },
      { zh: "主体越清晰、与背景对比越明显，自动结果越稳定", en: "Automatic results are most reliable when the subject is clear and contrasts with the background" },
      { zh: "可在结果中手动补回主体、擦除残留背景并柔化边缘", en: "Restore the subject, erase leftover background, and soften edges in the result" },
      { zh: "首次使用约需准备 4.6 MB，优先使用 GPU，并自动回退到本机 CPU", en: "The first run prepares about 4.6 MB, prefers the GPU, and automatically falls back to this device's CPU" },
    ]} />}
  ><ImageWorkflowNav active="remove" /><BackgroundRemovalBatchStudio /></ToolShell>
}
