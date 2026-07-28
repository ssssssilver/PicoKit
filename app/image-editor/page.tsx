import type { Metadata } from "next"

import { ImageBatchWorkspacePage } from "@/components/image-batch-workspace-page"

export const metadata: Metadata = {
  title: "免费批量快速修图、标注与打码",
  description: "批量添加图片后逐张裁剪、旋转、调色、标注和打码，处理结果可继续统一压缩和转换；图片不上传。",
}

export default function Page() {
  return <ImageBatchWorkspacePage initialPanel="edit" />
}
