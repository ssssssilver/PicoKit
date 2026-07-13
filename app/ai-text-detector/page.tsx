import type { Metadata } from "next"
import { Bot } from "lucide-react"

import { TextDetectorTool } from "@/components/text-detector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 AI 文本检测", description: "使用浏览器本地 ONNX 模型分析英文文本的 AI 风险、分段证据与不确定性。无需登录，不上传文本。" }

export default function Page() {
  return <ToolShell title="免费 AI 文本检测" description="模型在你的浏览器中运行，文本不会发送到服务器。结果包含风险区间、分段证据和稳定度，而不是武断的真假结论。" eyebrow="AI Text Detector" icon={Bot} aside={<ToolAside notes={["主要适用于较长英文文本", "首次使用需要下载约百 MB 模型", "不要把分数作为处罚的唯一依据"]} />}><TextDetectorTool /></ToolShell>
}

