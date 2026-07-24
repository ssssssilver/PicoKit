import type { Metadata } from "next"

import { ImageBatchWorkspacePage } from "@/components/image-batch-workspace-page"

export const metadata: Metadata = {
  title: "图片批量处理：去背景、修图、压缩与转换",
  description: "一次导入最多 30 张图片，在同一个浏览器本地工作台按需完成去背景、修边换背景、快速修图、格式转换、尺寸压缩和 ZIP 下载。",
}

export default function Page() {
  return <ImageBatchWorkspacePage initialPanel="remove" />
}
