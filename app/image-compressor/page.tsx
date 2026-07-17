import type { Metadata } from "next"
import { ImageDown } from "lucide-react"

import { ImageDeliveryEntry } from "@/components/image-delivery-entry"
import { ImageCompressorTool } from "@/components/image-compressor-tool"
import { ImageWorkflowNav } from "@/components/image-workflow-nav"
import { Localized } from "@/components/localized"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费批量图片压缩、转换与目标大小优化",
  description: "在浏览器本地批量压缩和转换 JPG、PNG、WebP，设置最长边、质量、目标 KB 与命名规则，并打包下载，不上传图片。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "批量图片优化与交付", en: "Batch Image Optimization and Delivery" }}
    description={{ zh: "一次加入多张图片，在当前设备统一转换格式、缩放尺寸、控制质量或目标大小，并逐张下载或打包交付。", en: "Add multiple images and convert formats, resize, tune quality or target size on this device, then download individually or as one package." }}
    eyebrow="Local Image Delivery"
    icon={ImageDown}
    aside={<ToolAside notes={[
      { zh: "多张图片按顺序处理，减少内存峰值", en: "Images are processed sequentially to reduce peak memory" },
      { zh: "支持 JPG、PNG、WebP 与目标 KB", en: "Supports JPG, PNG, WebP, and target KB" },
      { zh: "重新编码默认不保留原始元数据", en: "Re-encoding does not retain source metadata by default" },
    ]} />}
  >
    <ImageWorkflowNav active="optimize" />
    <ImageDeliveryEntry />
    <details className="group mt-6 overflow-hidden rounded-xl border border-white/10 bg-white/[.02]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-zinc-200">
        <span><Localized zh="需要裁切、调色、旋转或添加水印？展开单张精细处理" en="Need cropping, color tuning, rotation, or a watermark? Open single-image controls" /></span>
        <span className="text-xs font-normal text-zinc-500 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-white/10 p-4 sm:p-5"><ImageCompressorTool /></div>
    </details>
  </ToolShell>
}
