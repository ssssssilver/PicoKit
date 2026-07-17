import type { Metadata } from "next"
import { Clapperboard } from "lucide-react"

import { VideoTool } from "@/components/video-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费视频取帧、旋转与静音片段导出", description: "在浏览器本地把当前视频帧导出为 PNG，旋转输出，并生成最长 60 秒的静音 WebM 片段。" }
export default function Page() { return <ToolShell title={{ zh: "视频取帧、旋转与静音片段", en: "Capture Frames, Rotate Video, and Export Muted Clips" }} description={{ zh: "把当前视频帧导出为 PNG，或选择 60 秒以内的片段，旋转后导出静音 WebM。", en: "Export the current video frame as a PNG, or select a clip of up to 60 seconds, rotate it, and export a muted WebM." }} eyebrow="Local Video Toolkit" icon={Clapperboard} aside={<ToolAside notes={[{ zh: "输入格式取决于浏览器解码支持", en: "Input formats depend on browser decoding support" }, { zh: "静音片段以实时速度生成", en: "Muted clips are generated in real time" }, { zh: "不提供任意格式转码", en: "Arbitrary format conversion is not provided" }]} />}><VideoTool /></ToolShell> }
