import type { Metadata } from "next"

import { ImageBatchWorkspacePage } from "@/components/image-batch-workspace-page"

export const metadata: Metadata = {
  title: "免费批量快速修图、标注与打码",
  description: "直接打开图片批量处理工作台的快速修图面板，在浏览器本地逐张裁剪、旋转、调色、标注和打码，并继续统一输出。",
}

export default function Page() {
  return <ImageBatchWorkspacePage initialPanel="edit" />
}
