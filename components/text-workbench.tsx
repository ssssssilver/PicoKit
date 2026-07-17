"use client"

import { ArrowDownAZ, Copy, Download, Eraser } from "lucide-react"
import { useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { downloadText } from "@/lib/browser-files"

type Mode = "stats" | "lines" | "encode" | "diff"

export function TextWorkbench() {
  const { pick } = useLanguage()
  const [mode, setMode] = useState<Mode>("stats")
  const [text, setText] = useState("")
  const [compare, setCompare] = useState("")
  const [output, setOutput] = useState("")
  const stats = useMemo(() => textStats(text), [text])
  const diff = useMemo(() => mode === "diff" ? lineDiff(text, compare) : [], [mode, text, compare])

  function lineAction(action: "dedupe" | "sort" | "trim" | "empty" | "upper" | "lower" | "fullwidth" | "halfwidth" | "punctuation") {
    const result = transformLines(text, action)
    setOutput(result)
  }

  function codec(action: string) {
    try { setOutput(runCodec(text, action)) } catch { setOutput(pick("输入内容无法执行该转换", "The input cannot be converted with this operation")) }
  }

  const result = output || text
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("文本工作台", "Text workbench")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2">{(["stats", "lines", "encode", "diff"] as Mode[]).map((item) => <Button key={item} variant={mode === item ? "default" : "outline"} onClick={() => { setMode(item); setOutput("") }}>{item === "stats" ? pick("统计", "Statistics") : item === "lines" ? pick("清理与排序", "Clean and sort") : item === "encode" ? pick("编解码", "Encode and decode") : pick("文本对比", "Text diff")}</Button>)}</div>
      <div className={`grid gap-4 ${mode === "diff" ? "lg:grid-cols-2" : ""}`}><label className="space-y-2 text-sm"><span>{pick("输入文本", "Input text")}</span><Textarea value={text} onChange={(event) => { setText(event.target.value); setOutput("") }} className="min-h-64 font-mono" placeholder={pick("粘贴要处理的文本…", "Paste text to process…")} /></label>{mode === "diff" ? <label className="space-y-2 text-sm"><span>{pick("对比文本", "Comparison text")}</span><Textarea value={compare} onChange={(event) => setCompare(event.target.value)} className="min-h-64 font-mono" placeholder={pick("粘贴另一个版本…", "Paste another version…")} /></label> : null}</div>
      {mode === "stats" ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><Stat label={pick("字符", "Characters")} value={stats.characters} /><Stat label={pick("不含空格", "No spaces")} value={stats.noSpaces} /><Stat label={pick("单词", "Words")} value={stats.words} /><Stat label={pick("行", "Lines")} value={stats.lines} /><Stat label={pick("段落", "Paragraphs")} value={stats.paragraphs} /><Stat label={pick("阅读", "Reading")} value={`${stats.minutes} min`} /></div> : null}
      {mode === "lines" ? <div className="flex flex-wrap gap-2"><Button onClick={() => lineAction("dedupe")}><Eraser />{pick("按行去重", "Dedupe lines")}</Button><Button variant="outline" onClick={() => lineAction("sort")}><ArrowDownAZ />{pick("按行排序", "Sort lines")}</Button><Button variant="outline" onClick={() => lineAction("trim")}>{pick("修剪空格", "Trim spaces")}</Button><Button variant="outline" onClick={() => lineAction("empty")}>{pick("删除空行", "Remove empty lines")}</Button><Button variant="outline" onClick={() => lineAction("upper")}>UPPERCASE</Button><Button variant="outline" onClick={() => lineAction("lower")}>lowercase</Button><Button variant="outline" onClick={() => lineAction("fullwidth")}>{pick("转全角", "To full-width")}</Button><Button variant="outline" onClick={() => lineAction("halfwidth")}>{pick("转半角", "To half-width")}</Button><Button variant="outline" onClick={() => lineAction("punctuation")}>{pick("规范中文标点", "Normalize Chinese punctuation")}</Button></div> : null}
      {mode === "encode" ? <div className="flex flex-wrap gap-2">{[["url-encode","URL Encode"],["url-decode","URL Decode"],["base64-encode","Base64 Encode"],["base64-decode","Base64 Decode"],["html-encode","HTML Encode"],["html-decode","HTML Decode"],["unicode-encode","Unicode Encode"],["unicode-decode","Unicode Decode"],["hex-encode","Hex Encode"],["hex-decode","Hex Decode"]].map(([action,label]) => <Button key={action} variant="outline" onClick={() => codec(action)}>{label}</Button>)}</div> : null}
      {output ? <div className="space-y-3"><p className="text-sm font-medium">{pick("处理结果", "Result")}</p><Textarea value={output} onChange={(event) => setOutput(event.target.value)} className="min-h-48 font-mono" /><div className="flex gap-2"><Button onClick={() => navigator.clipboard.writeText(output)}><Copy />{pick("复制", "Copy")}</Button><Button variant="outline" onClick={() => downloadText(output, "tabnative-text.txt")}><Download />{pick("下载", "Download")}</Button></div></div> : null}
    </CardContent></Card>
    {mode === "diff" ? <Card><CardHeader><CardTitle>{pick("逐行差异", "Line-by-line differences")}</CardTitle></CardHeader><CardContent><div className="overflow-hidden rounded-lg border border-white/10 font-mono text-xs">{diff.map((row, index) => <div key={`${index}-${row.text}`} className={`grid grid-cols-[34px_1fr] border-b border-white/5 px-2 py-1.5 last:border-0 ${row.kind === "add" ? "bg-emerald-400/10 text-emerald-200" : row.kind === "remove" ? "bg-red-400/10 text-red-200" : "text-zinc-500"}`}><span>{row.kind === "add" ? "+" : row.kind === "remove" ? "−" : ""}</span><span className="whitespace-pre-wrap break-all">{row.text || " "}</span></div>)}</div></CardContent></Card> : null}
    {result && !output && mode !== "diff" ? <div className="flex gap-2"><Button variant="outline" onClick={() => navigator.clipboard.writeText(result)}><Copy />{pick("复制当前文本", "Copy current text")}</Button></div> : null}
  </div>
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border border-white/10 bg-white/[.02] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div> }

export function textStats(text: string) {
  const trimmed = text.trim()
  const words = trimmed ? (trimmed.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length : 0
  return { characters: text.length, noSpaces: text.replace(/\s/g, "").length, words, lines: text ? text.split(/\r?\n/).length : 0, paragraphs: trimmed ? trimmed.split(/\n\s*\n/).length : 0, minutes: Math.max(0, Math.ceil(words / 220)) }
}

export function transformLines(text: string, action: string) {
  if (action === "upper") return text.toUpperCase()
  if (action === "lower") return text.toLowerCase()
  if (action === "fullwidth") return [...text].map((char) => char === " " ? "　" : char >= "!" && char <= "~" ? String.fromCharCode(char.charCodeAt(0) + 0xfee0) : char).join("")
  if (action === "halfwidth") return [...text].map((char) => char === "　" ? " " : char >= "！" && char <= "～" ? String.fromCharCode(char.charCodeAt(0) - 0xfee0) : char).join("")
  if (action === "punctuation") return text.replace(/,/g, "，").replace(/\?/g, "？").replace(/!/g, "！").replace(/:/g, "：").replace(/;/g, "；")
  let lines = text.split(/\r?\n/)
  if (action === "dedupe") lines = [...new Set(lines)]
  if (action === "sort") lines.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  if (action === "trim") lines = lines.map((line) => line.trim())
  if (action === "empty") lines = lines.filter((line) => line.trim())
  return lines.join("\n")
}

export function runCodec(text: string, action: string) {
  if (action === "url-encode") return encodeURIComponent(text)
  if (action === "url-decode") return decodeURIComponent(text)
  if (action === "base64-encode") return btoa(unescape(encodeURIComponent(text)))
  if (action === "base64-decode") return decodeURIComponent(escape(atob(text.trim())))
  if (action === "html-encode") return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
  if (action === "html-decode") { const area = document.createElement("textarea"); area.innerHTML = text; return area.value }
  if (action === "unicode-encode") return [...text].map((char) => `\\u{${char.codePointAt(0)!.toString(16)}}`).join("")
  if (action === "unicode-decode") return text.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_match, wide, short) => String.fromCodePoint(Number.parseInt(wide || short, 16)))
  if (action === "hex-encode") return [...new TextEncoder().encode(text)].map((byte) => byte.toString(16).padStart(2, "0")).join(" ")
  if (action === "hex-decode") return new TextDecoder().decode(new Uint8Array(text.trim().split(/\s+/).map((value) => Number.parseInt(value, 16))))
  return text
}

export function lineDiff(left: string, right: string) {
  const a = left.split(/\r?\n/); const b = right.split(/\r?\n/)
  const rows: Array<{ kind: "same" | "add" | "remove"; text: string }> = []
  const max = Math.max(a.length, b.length)
  for (let index = 0; index < max; index++) {
    if (a[index] === b[index]) rows.push({ kind: "same", text: a[index] ?? "" })
    else { if (a[index] !== undefined) rows.push({ kind: "remove", text: a[index] }); if (b[index] !== undefined) rows.push({ kind: "add", text: b[index] }) }
  }
  return rows
}
