"use client"

import { Braces, Copy, Download, Minimize2, WandSparkles } from "lucide-react"
import { useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { downloadText } from "@/lib/browser-files"

export function JsonTool() {
  const { pick } = useLanguage()
  const [text, setText] = useState('{\n  "name": "TabNative",\n  "local": true\n}')
  const [output, setOutput] = useState("")
  const [path, setPath] = useState("$.name")
  const [error, setError] = useState("")
  const parsed = useMemo(() => { try { return JSON.parse(text) } catch { return null } }, [text])

  function run(action: "format" | "minify" | "query" | "csv" | "csv-json") {
    setError("")
    try {
      if (action === "csv-json") { setOutput(JSON.stringify(csvToJson(text), null, 2)); return }
      const value = JSON.parse(text)
      if (action === "format") setOutput(JSON.stringify(value, null, 2))
      if (action === "minify") setOutput(JSON.stringify(value))
      if (action === "query") setOutput(JSON.stringify(queryJson(value, path), null, 2))
      if (action === "csv") setOutput(jsonToCsv(value))
    } catch (reason) {
      setOutput("")
      const message = reason instanceof SyntaxError ? formatJsonError(reason.message, text) : reason instanceof Error ? reason.message : pick("JSON 无效", "Invalid JSON")
      setError(message)
    }
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("JSON 格式化与查询", "Format and query JSON")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <Textarea aria-label={pick("JSON 输入", "JSON input")} value={text} onChange={(event) => { setText(event.target.value); setError(""); setOutput("") }} className="min-h-80 font-mono text-xs" spellCheck={false} />
      <div className="flex flex-wrap gap-2"><Button onClick={() => run("format")}><WandSparkles />{pick("格式化", "Format")}</Button><Button variant="outline" onClick={() => run("minify")}><Minimize2 />{pick("压缩", "Minify")}</Button><Button variant="outline" onClick={() => run("csv")}>{pick("JSON 转 CSV", "JSON to CSV")}</Button><Button variant="outline" onClick={() => run("csv-json")}>{pick("CSV 转 JSON", "CSV to JSON")}</Button><Button variant="outline" onClick={() => { setText(""); setOutput("") }}>{pick("清空", "Clear")}</Button></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input value={path} onChange={(event) => setPath(event.target.value)} placeholder="$.items[0].name" /><Button variant="outline" onClick={() => run("query")}><Braces />JSONPath</Button></div>
      {error ? <Alert variant="destructive"><Braces /><AlertTitle>{pick("JSON 校验失败", "JSON validation failed")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : parsed !== null ? <p className="text-xs text-emerald-300">{pick("JSON 语法有效", "Valid JSON syntax")}</p> : null}
      {parsed !== null ? <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-medium">{pick("树形浏览", "Tree view")}</summary><div className="mt-3 max-h-96 overflow-auto font-mono text-xs"><JsonTree value={parsed} /></div></details> : null}
    </CardContent></Card>
    {output ? <Card><CardHeader><CardTitle>{pick("结果", "Result")}</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={output} onChange={(event) => setOutput(event.target.value)} className="min-h-56 font-mono text-xs" /><div className="flex gap-2"><Button onClick={() => navigator.clipboard.writeText(output)}><Copy />{pick("复制", "Copy")}</Button><Button variant="outline" onClick={() => downloadText(output, output.includes(",") && !output.trim().startsWith("{") ? "tabnative.csv" : "tabnative.json", output.trim().startsWith("{") || output.trim().startsWith("[") ? "application/json" : "text/csv") }><Download />{pick("下载", "Download")}</Button></div></CardContent></Card> : null}
  </div>
}

export function queryJson(value: unknown, path: string) {
  const normalized = path.trim().replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, ".$1")
  if (!normalized) return value
  return normalized.split(".").filter(Boolean).reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object" || !(key in current)) throw new Error(`Path not found: ${path}`)
    return (current as Record<string, unknown>)[key]
  }, value)
}

export function jsonToCsv(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === "object" && !Array.isArray(item))) throw new Error("CSV conversion requires an array of objects")
  const rows = value as Record<string, unknown>[]
  const headers = [...new Set(rows.flatMap(Object.keys))]
  const encode = (cell: unknown) => `"${String(cell ?? "").replace(/"/g, '""')}"`
  return [headers.map(encode).join(","), ...rows.map((row) => headers.map((header) => encode(row[header])).join(","))].join("\n")
}

export function csvToJson(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === "," && !quoted) { row.push(cell); cell = ""; continue }
    if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index++; row.push(cell); if (row.some((value) => value.length)) rows.push(row); row = []; cell = ""; continue }
    cell += char
  }
  row.push(cell); if (row.some((value) => value.length)) rows.push(row)
  const [headers, ...body] = rows; if (!headers?.length) return []
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
}

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || typeof value !== "object") return <span className="text-cyan-200">{JSON.stringify(value)}</span>
  const entries = Object.entries(value).slice(0, 200)
  return <ul className={depth ? "ml-4 border-l border-white/10 pl-3" : ""}>{entries.map(([key, child]) => <li key={key} className="py-0.5"><span className="text-violet-300">{key}</span>: <JsonTree value={child} depth={depth + 1} /></li>)}{Object.keys(value).length > 200 ? <li className="text-zinc-500">…</li> : null}</ul>
}

function formatJsonError(message: string, text: string) {
  const position = Number(message.match(/position (\d+)/)?.[1])
  if (!Number.isFinite(position)) return message
  const before = text.slice(0, position); const line = before.split("\n").length; const column = position - before.lastIndexOf("\n")
  return `${message} (${line}:${column})`
}
