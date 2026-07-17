import type { Metadata } from "next"
import { CalendarClock } from "lucide-react"

import { DateTimeTool } from "@/components/date-time-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "时间戳、时区、日期间隔与年龄计算", description: "本地转换 Unix 时间戳和 ISO 时间，查看常用时区，并计算日期间隔与精确年龄。" }
export default function Page() { return <ToolShell title={{ zh: "日期、时间戳与时区工具", en: "Date, Timestamp, and Time-zone Tools" }} description={{ zh: "转换秒或毫秒时间戳、ISO 时间和常用时区，并计算日期间隔与精确年龄。", en: "Convert seconds or milliseconds timestamps, ISO dates, and common time zones, then calculate date durations and exact ages." }} eyebrow="Local Date & Time Toolkit" icon={CalendarClock} aside={<ToolAside notes={[{ zh: "时间戳自动识别秒或毫秒", en: "Timestamps are detected as seconds or milliseconds" }, { zh: "时区显示使用浏览器 Intl 数据", en: "Time-zone display uses browser Intl data" }, { zh: "日期计算不发送到网络", en: "Date calculations stay on the device" }]} />}><DateTimeTool /></ToolShell> }
