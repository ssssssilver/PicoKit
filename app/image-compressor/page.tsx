import type { Metadata } from "next"

import { ImageBatchWorkspacePage } from "@/components/image-batch-workspace-page"

export const metadata: Metadata = {
  title: "免费批量图片压缩、转换与目标大小优化",
  description: "批量转换 JPG、PNG、WebP，统一调整尺寸、清晰度和目标文件大小，并单独下载或打包为 ZIP；图片不上传。",
}

export default function Page() {
  return <ImageBatchWorkspacePage initialPanel="optimize" />
}
