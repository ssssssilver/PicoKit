import type { Metadata } from "next"
import { Timer } from "lucide-react"

import { TimerTool } from "@/components/timer-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费倒计时、番茄钟与秒表", description: "在浏览器中使用倒计时、25 分钟番茄钟和秒表，完成记录只保存在当前浏览器。" }
export default function Page() { return <ToolShell title={{ zh: "倒计时、番茄钟与秒表", en: "Countdown, Pomodoro, and Stopwatch" }} description={{ zh: "开始倒计时、25 分钟专注计时或秒表，并在当前浏览器保存最近完成记录。", en: "Run a countdown, a 25-minute focus timer, or a stopwatch, with recent completions saved in this browser." }} eyebrow="Local Timer Toolkit" icon={Timer} aside={<ToolAside notes={[{ zh: "关闭页面会停止正在运行的计时", en: "Closing the page stops active timing" }, { zh: "完成时播放简短提示音", en: "A short tone plays on completion" }, { zh: "历史只保存在当前浏览器", en: "History stays only in this browser" }]} />}><TimerTool /></ToolShell> }
