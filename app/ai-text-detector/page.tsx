import type { Metadata } from "next"
import { Bot } from "lucide-react"

import { TextDetectorTool } from "@/components/text-detector-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 AI 文本检测", description: "检测较长英文文本是否可能由 AI 生成，并按段落标出结果；无需登录，文本不上传。" }

export default function Page() {
  return <ToolShell title={{ zh: "免费 AI 文本检测", en: "Free AI Text Detector" }} description={{ zh: "粘贴一段较长英文文本，检测是否可能由 AI 生成，并按段落查看结果。文本只在当前浏览器中处理，不会发送到服务器。", en: "Detection runs in your browser, so text never goes to a server. Results include a risk range, segment evidence, and stability instead of a binary claim." }} eyebrow="AI Text Detector" icon={Bot} aside={<ToolAside notes={[{ zh: "更适合 150～200 个英文词以上的文本", en: "Best suited to longer English text" }, { zh: "第一次打开可能稍慢，之后会更快", en: "First-time setup may take longer; later runs are faster" }, { zh: "检测结果仅供参考，不要作为处罚的唯一依据", en: "Never use the score as the sole basis for a penalty" }]} />}><TextDetectorTool /></ToolShell>
}
