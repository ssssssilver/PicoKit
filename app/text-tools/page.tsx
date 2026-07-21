import type { Metadata } from "next"
import { TextCursorInput } from "lucide-react"

import { TextWorkbench } from "@/components/text-workbench"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费文本统计、去重、排序与编解码", description: "本地统计文字、按行去重排序、URL/Base64/Unicode/Hex 编解码并比较文本差异。" }
export default function Page() { return <ToolShell title={{ zh: "文本统计、清理与编解码", en: "Count, Clean, Encode, and Decode Text" }} description={{ zh: "统计字数，按行去重或排序，完成常用编解码并比较文本差异。", en: "Count text, deduplicate or sort lines, encode and decode common formats, and compare versions in one workbench." }} eyebrow="ON-DEVICE TEXT PROCESSING" icon={TextCursorInput} aside={<ToolAside notes={[{ zh: "默认不把输入写入本地存储", en: "Input is not stored in local storage" }, { zh: "支持 UTF-8 Base64 与 Hex", en: "UTF-8 Base64 and Hex are supported" }, { zh: "大段文本建议分批处理", en: "Process very large text in smaller batches" }]} />}><TextWorkbench /></ToolShell> }
