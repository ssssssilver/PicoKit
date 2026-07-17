import type { Metadata } from "next"
import { AudioLines } from "lucide-react"

import { AudioTool } from "@/components/audio-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费音频裁剪、淡入淡出与 WAV 导出", description: "在浏览器本地裁剪音频、调整音量、淡入淡出、转换单声道并导出 WAV。" }
export default function Page() { return <ToolShell title={{ zh: "音频裁剪、音量与淡入淡出", en: "Trim Audio, Adjust Volume, and Fade" }} description={{ zh: "查看波形、选择时间范围、调整音量和淡入淡出，最后导出兼容性良好的 WAV。", en: "View a waveform, select a time range, adjust volume and fades, then export a broadly compatible WAV." }} eyebrow="Local Audio Toolkit" icon={AudioLines} aside={<ToolAside notes={[{ zh: "输入格式取决于当前浏览器解码能力", en: "Input formats depend on browser decoding support" }, { zh: "导出格式固定为 WAV", en: "Output is exported as WAV" }, { zh: "长音频需要较多设备内存", en: "Long audio requires more device memory" }]} />}><AudioTool /></ToolShell> }
