import type { Metadata } from "next"

import { ImageBatchWorkspacePage } from "@/components/image-batch-workspace-page"

export const metadata: Metadata = {
  title: "免费批量图片压缩、转换与目标大小优化",
  description: "直接打开图片批量处理工作台的输出面板，在浏览器本地批量转换 JPG、PNG、WebP，调整尺寸、质量与目标大小并打包下载。",
}

export default function Page() {
  return <ImageBatchWorkspacePage initialPanel="optimize" />
}
