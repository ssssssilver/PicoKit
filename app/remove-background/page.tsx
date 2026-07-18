import type { Metadata } from "next"
import { Workflow } from "lucide-react"

import { BackgroundRemovalBatchStudio } from "@/components/background-removal-batch-studio"
import { ImageWorkflowNav } from "@/components/image-workflow-nav"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "本地图片交付流水线：批量去背景、修图与优化",
  description: "一次导入最多 30 张图片，在浏览器本地连续完成批量去背景与修边、快速修图、格式尺寸优化和打包交付。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "图片交付流水线：批量去背景", en: "Image Delivery Pipeline: Background Removal" }}
    description={{ zh: "这是图片交付流水线的第一步：一次加入多张图片，在设备端按队列生成透明背景并逐项修边；完成后整批接力到快速修图和最终优化，无需重新上传。", en: "This is the first stage of the Image Delivery Pipeline: add a batch, remove backgrounds and refine edges on your device, then pass every completed image to quick editing and final optimization without uploading again." }}
    eyebrow="Local Image Delivery Pipeline"
    icon={Workflow}
    aside={<ToolAside notes={[
      { zh: "自动识别主要主体，无需选择处理模式", en: "Automatically detects the main subject with no processing mode to choose" },
      { zh: "主体越清晰、与背景对比越明显，自动结果越稳定", en: "Automatic results are most reliable when the subject is clear and contrasts with the background" },
      { zh: "可在结果中手动补回主体、擦除残留背景并柔化边缘", en: "Restore the subject, erase leftover background, and soften edges in the result" },
      { zh: "首次使用约需准备 4.6 MB，优先使用 GPU，并自动回退到本机 CPU", en: "The first run prepares about 4.6 MB, prefers the GPU, and automatically falls back to this device's CPU" },
    ]} />}
  ><ImageWorkflowNav active="remove" /><BackgroundRemovalBatchStudio /></ToolShell>
}
