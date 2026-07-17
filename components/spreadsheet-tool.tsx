"use client"

import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { baseName, downloadBlob, downloadText, formatBytes, safeError } from "@/lib/browser-files"

type SheetState = { file: File; names: string[]; selected: string; rows: unknown[][]; workbook: import("xlsx").WorkBook }

export function SpreadsheetTool() {
  const { pick } = useLanguage()
  const [state, setState] = useState<SheetState | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  async function open(file: File | undefined) {
    if (!file) return
    setRunning(true); setError("")
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error(pick("表格文件不能超过 50 MB", "Spreadsheet files must be 50 MB or smaller"))
      const XLSX = await import("xlsx")
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
      const selected = workbook.SheetNames[0]
      setState({ file, names: workbook.SheetNames, selected, rows: XLSX.utils.sheet_to_json(workbook.Sheets[selected], { header: 1, raw: false, defval: "" }), workbook })
    } catch (reason) { setError(safeError(reason, pick("表格读取失败", "Unable to read spreadsheet"))) }
    finally { setRunning(false) }
  }

  async function select(name: string) {
    if (!state) return
    const XLSX = await import("xlsx")
    setState({ ...state, selected: name, rows: XLSX.utils.sheet_to_json(state.workbook.Sheets[name], { header: 1, raw: false, defval: "" }) })
  }

  async function exportFormat(format: "csv" | "json" | "xlsx") {
    if (!state) return
    const XLSX = await import("xlsx"); const sheet = state.workbook.Sheets[state.selected]; const name = baseName(state.file.name)
    if (format === "csv") downloadText(XLSX.utils.sheet_to_csv(sheet), `${name}-${state.selected}.csv`, "text/csv;charset=utf-8")
    else if (format === "json") downloadText(JSON.stringify(XLSX.utils.sheet_to_json(sheet, { defval: "" }), null, 2), `${name}-${state.selected}.json`, "application/json")
    else downloadBlob(new Blob([XLSX.write(state.workbook, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`)
  }

  const previewRows = state?.rows.slice(0, 50) ?? []
  const maxColumns = Math.min(20, Math.max(0, ...previewRows.map((row) => row.length)))
  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("表格预览与转换", "Preview and convert spreadsheets")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 hover:border-cyan-300/40"><FileSpreadsheet className="mb-2 text-cyan-300" />{running ? <LoaderCircle className="animate-spin" /> : <span className="text-sm">{state ? `${state.file.name} · ${formatBytes(state.file.size)}` : pick("选择 XLSX、XLS、CSV 或 TSV", "Choose XLSX, XLS, CSV, or TSV")}</span>}<input className="sr-only" type="file" accept=".xlsx,.xls,.csv,.tsv,text/csv" onChange={(event) => void open(event.target.files?.[0])} /></label>
    {state ? <><div className="flex flex-wrap items-end gap-3"><label className="space-y-2 text-sm"><span>{pick("工作表", "Sheet")}</span><select value={state.selected} onChange={(event) => void select(event.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-3">{state.names.map((name) => <option key={name}>{name}</option>)}</select></label><Button onClick={() => exportFormat("csv")}><Download />CSV</Button><Button variant="outline" onClick={() => exportFormat("json")}><Download />JSON</Button><Button variant="outline" onClick={() => exportFormat("xlsx")}><Download />XLSX</Button></div><p className="text-xs text-zinc-500">{state.rows.length} {pick("行，预览前 50 行和前 20 列", "rows; previewing the first 50 rows and 20 columns")}</p></> : null}
    {error ? <Alert variant="destructive"><FileSpreadsheet /><AlertTitle>{pick("无法读取", "Unable to read")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </CardContent></Card>
  {state ? <Card><CardContent className="p-0"><div className="max-h-[560px] overflow-auto"><table className="min-w-full border-collapse text-xs"><tbody>{previewRows.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? "sticky top-0 bg-[#171717] font-semibold" : ""}>{Array.from({ length: maxColumns }, (_, columnIndex) => <td key={columnIndex} className="max-w-64 truncate border border-white/10 px-3 py-2" title={String(row[columnIndex] ?? "")}>{String(row[columnIndex] ?? "")}</td>)}</tr>)}</tbody></table></div></CardContent></Card> : null}</div>
}
