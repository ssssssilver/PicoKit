import type { Metadata } from "next"
import { FileSpreadsheet } from "lucide-react"

import { SpreadsheetTool } from "@/components/spreadsheet-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 XLSX、CSV、JSON 表格转换", description: "在浏览器本地预览 XLSX、XLS、CSV、TSV 工作表，并导出 CSV、JSON 或 XLSX。" }
export default function Page() { return <ToolShell title={{ zh: "表格预览与 XLSX、CSV、JSON 转换", en: "Preview and Convert XLSX, CSV, and JSON" }} description={{ zh: "读取本地表格、切换工作表并导出 CSV、JSON 或 XLSX。预览限制行列数，避免大文件拖慢设备。", en: "Read local spreadsheets, switch sheets, and export CSV, JSON, or XLSX with bounded previews for large files." }} eyebrow="Local Spreadsheet Converter" icon={FileSpreadsheet} aside={<ToolAside notes={[{ zh: "预览前 50 行、20 列", en: "Preview is limited to 50 rows and 20 columns" }, { zh: "不执行宏或外部数据连接", en: "Macros and external data connections are not executed" }, { zh: "复杂公式只保留已有结果", en: "Complex formulas retain cached results only" }]} />}><SpreadsheetTool /></ToolShell> }
