import type { Metadata } from "next"
import { Braces } from "lucide-react"

import { JsonTool } from "@/components/json-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 JSON 格式化、校验与 CSV 转换", description: "本地格式化、压缩和校验 JSON，执行基础 JSONPath 查询并把对象数组转为 CSV。" }
export default function Page() { return <ToolShell title={{ zh: "JSON 格式化、校验与转换", en: "Format, Validate, and Convert JSON" }} description={{ zh: "格式化或压缩 JSON、定位语法错误、查询字段，并把对象数组转换成 CSV。", en: "Format or minify JSON, locate syntax errors, query values, and convert arrays of objects to CSV." }} eyebrow="Local JSON Toolkit" icon={Braces} aside={<ToolAside notes={[{ zh: "JSONPath 支持点路径与数组索引", en: "JSONPath supports dotted paths and array indexes" }, { zh: "不会执行 JSON 中的代码", en: "Code inside JSON is never executed" }, { zh: "CSV 单元格会自动转义", en: "CSV cells are escaped automatically" }]} />}><JsonTool /></ToolShell> }
