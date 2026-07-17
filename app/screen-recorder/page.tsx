import type { Metadata } from "next"
import { MonitorUp } from "lucide-react"

import { ScreenRecorderTool } from "@/components/screen-recorder-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费本地屏幕录制工具", description: "通过浏览器授权录制屏幕、窗口或标签页，可选择系统声音和麦克风，录像不上传。" }
export default function Page() { return <ToolShell title={{ zh: "屏幕、窗口与标签页录制", en: "Screen, Window, and Tab Recorder" }} description={{ zh: "使用浏览器共享面板选择录制范围，可按浏览器能力加入共享声音或麦克风，并在本地预览下载。", en: "Choose a recording source through the browser share panel, optionally include shared audio or a microphone, and preview or download locally." }} eyebrow="Local Screen Recorder" icon={MonitorUp} aside={<ToolAside notes={[{ zh: "只有点击开始后才请求权限", en: "Permission is requested only after Start" }, { zh: "输出格式取决于浏览器支持", en: "Output format depends on browser support" }, { zh: "刷新页面会清除未下载的录像", en: "Refreshing clears recordings not yet downloaded" }]} />}><ScreenRecorderTool /></ToolShell> }
