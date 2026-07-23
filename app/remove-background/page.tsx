import type { Metadata } from "next"
import { Workflow } from "lucide-react"

import { BackgroundRemovalBatchStudio } from "@/components/background-removal-batch-studio"
import { ImageWorkflowNav } from "@/components/image-workflow-nav"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "图片批量处理：去背景、修图、压缩与转换",
  description: "一次导入最多 30 张图片，在浏览器本地连续完成批量去背景与修边、快速修图、格式尺寸优化和打包交付。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "图片批量处理", en: "Batch Image Processing" }}
    description={{ zh: "一次加入最多 30 张图片，批量去除背景并逐张修边；随后可直接继续修图，再统一调整格式、尺寸和文件大小，无需重新选择图片。", en: "Add up to 30 images, remove backgrounds in a batch, and refine each result. Continue directly to image editing, then adjust format, dimensions, and file size together without selecting the images again." }}
    eyebrow="ON-DEVICE BATCH IMAGE PROCESSING"
    icon={Workflow}
    aside={<ToolAside notes={[
      { zh: "自动识别主要主体，无需选择处理模式", en: "Automatically detects the main subject with no processing mode to choose" },
      { zh: "主体越清晰、与背景对比越明显，自动结果越稳定", en: "Automatic results are most reliable when the subject is clear and contrasts with the background" },
      { zh: "可在结果中手动补回主体、擦除残留背景并柔化边缘", en: "Restore the subject, erase leftover background, and soften edges in the result" },
      { zh: "首次使用约需准备 4.6 MB，优先使用 GPU，并自动回退到本机 CPU", en: "The first run prepares about 4.6 MB, prefers the GPU, and automatically falls back to this device's CPU" },
    ]} />}
  ><ImageWorkflowNav active="remove" /><BackgroundRemovalBatchStudio /></ToolShell>
}
