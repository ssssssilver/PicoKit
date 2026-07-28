import type { Metadata } from "next"

import { ImageBatchWorkspacePage } from "@/components/image-batch-workspace-page"

export const metadata: Metadata = {
  title: "图片批量处理：去背景、修图、压缩与转换",
  description: "一次添加最多 30 张图片，批量去背景、修边换背景、逐张修图、改尺寸、压缩和转换格式，最后统一打包下载；文件不上传。",
}

export default function Page() {
  return <ImageBatchWorkspacePage initialPanel="remove" />
}
