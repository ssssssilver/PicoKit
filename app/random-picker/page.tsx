import type { Metadata } from "next"
import { Shuffle } from "lucide-react"

import { RandomPickerTool } from "@/components/random-picker-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费随机抽取与名单分组工具", description: "使用浏览器安全随机数从名单中抽取一项或多项，或把候选人公平随机分组。" }
export default function Page() { return <ToolShell title={{ zh: "随机抽取与公平分组", en: "Random Picker and Fair Grouping" }} description={{ zh: "从本地名单随机抽取一个或多个选项，或把候选项打乱后平均分组。", en: "Randomly select one or more items from a local list, or shuffle candidates into balanced groups." }} eyebrow="Local Random Picker" icon={Shuffle} aside={<ToolAside notes={[{ zh: "随机数来自浏览器 Web Crypto", en: "Randomness comes from Web Crypto" }, { zh: "支持去除重复候选项", en: "Duplicate candidates can be removed" }, { zh: "不提供博彩或积分机制", en: "No gambling or points mechanics" }]} />}><RandomPickerTool /></ToolShell> }
