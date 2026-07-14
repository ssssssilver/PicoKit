import type { Metadata } from "next"
import { Bot } from "lucide-react"

import { TextDetectorTool } from "@/components/text-detector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 AI 文本检测", description: "在浏览器本地分析英文文本的 AI 风险、分段证据与不确定性。无需登录，不上传文本。" }

export default function Page() {
  return <ToolShell title={{ zh: "免费 AI 文本检测", en: "Free AI Text Detector" }} description={{ zh: "检测在你的浏览器中完成，文本不会发送到服务器。结果包含风险区间、分段证据和稳定度，而不是武断的真假结论。", en: "Detection runs in your browser, so text never goes to a server. Results include a risk range, segment evidence, and stability instead of a binary claim." }} eyebrow="AI Text Detector" icon={Bot} aside={<ToolAside notes={[{ zh: "主要适用于较长英文文本", en: "Best suited to longer English text" }, { zh: "首次准备可能稍慢，之后会更快", en: "First-time setup may take longer; later runs are faster" }, { zh: "不要把分数作为处罚的唯一依据", en: "Never use the score as the sole basis for a penalty" }]} />}><TextDetectorTool /></ToolShell>
}
