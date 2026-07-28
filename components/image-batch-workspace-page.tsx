import { Workflow } from "lucide-react"

import { ImageBatchWorkspace } from "@/components/image-batch-workspace"
import type { ImageWorkflowPanel } from "@/components/image-workflow-nav"
import { ToolShell } from "@/components/tool-shell"

export function ImageBatchWorkspacePage({ initialPanel = "remove" }: { initialPanel?: ImageWorkflowPanel }) {
  return (
    <ToolShell
      title={{ zh: "图片批量处理", en: "Batch Image Processing" }}
      description={{
        zh: "一次添加最多 30 张图片，批量去背景、修边换背景、逐张修图、改尺寸、压缩和转换格式，最后统一打包下载。切换功能不会清空已添加的图片。",
        en: "Add up to 30 images once, then use one local workspace for background removal, edge and background finishing, per-image quick edits, format conversion, resizing, compression, and ZIP downloads.",
      }}
      eyebrow="ON-DEVICE BATCH IMAGE WORKSPACE"
      icon={Workflow}
    >
      <ImageBatchWorkspace initialPanel={initialPanel} />
    </ToolShell>
  )
}
