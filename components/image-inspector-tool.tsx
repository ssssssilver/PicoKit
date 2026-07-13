"use client"

import { AlertTriangle, CheckCircle2, Download, FileSearch, LoaderCircle, Search, ShieldQuestion } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { inspectImage } from "@/lib/image-inspector"
import type { ImageInspection } from "@/lib/image-types"

export function ImageInspectorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImageInspection | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  function handleFile(next: File | null) { setFile(next); setResult(null); setError("") }

  async function analyze() {
    if (!file) return
    setRunning(true); setError("")
    try { setResult(await inspectImage(file)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "图片检查失败") }
    finally { setRunning(false) }
  }

  function exportReport() {
    if (!result) return
    const blob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), ...result }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `localproof-image-report-${Date.now()}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm"><CardContent className="p-5 sm:p-6"><FileDropzone file={file} onFile={handleFile} disabled={running} />{file ? <Button className="mt-4" size="lg" onClick={analyze} disabled={running}>{running ? <LoaderCircle className="animate-spin" /> : <Search />} {running ? "正在读取本地证据" : "检查图片来源"}</Button> : null}{error ? <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertTitle>检查失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}</CardContent></Card>

      {result ? (
        <div className="space-y-6">
          <Alert className={result.risk === "signals-found" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}>
            {result.risk === "signals-found" ? <AlertTriangle /> : <ShieldQuestion />}
            <AlertTitle>{result.risk === "signals-found" ? "发现 AI/来源信号" : "未发现明确 AI 来源信号"}</AlertTitle>
            <AlertDescription>{result.note}</AlertDescription>
          </Alert>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="size-4 text-cyan-700" />文件摘要</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <Info label="格式" value={result.format} /><Info label="文件大小" value={formatBytes(result.bytes)} /><Info label="尺寸" value={result.width ? `${result.width} × ${result.height}` : "无法读取"} /><Info label="元数据字段" value={`${result.metadata.length}`} />
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base">{result.c2pa.validated ? <CheckCircle2 className="size-4 text-emerald-600" /> : <ShieldQuestion className="size-4 text-slate-500" />}C2PA Content Credentials</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-6 text-slate-600">{result.c2pa.summary}</p><Badge variant="outline" className="mt-3">{result.c2pa.present ? result.c2pa.validated === true ? "清单可读取" : "存在/未完整验证" : "未检测到"}</Badge></CardContent>
            </Card>
          </div>
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">来源与 AI 信号</CardTitle><Button variant="outline" size="sm" onClick={exportReport}><Download />报告</Button></CardHeader>
            <CardContent>
              {result.signals.length ? <div className="space-y-2">{result.signals.map((signal) => <div key={signal.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"><div><p className="text-sm font-medium">{signal.label}</p><p className="mt-1 break-all text-xs text-slate-500">{signal.value}</p></div><Badge variant={signal.severity === "high" ? "destructive" : "secondary"}>{signal.severity === "high" ? "强信号" : signal.severity === "medium" ? "中等" : "信息"}</Badge></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">没有发现已知生成器、DigitalSourceType 或 C2PA 字段。</p>}
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none"><CardHeader><CardTitle className="text-base">原始元数据</CardTitle></CardHeader><CardContent>{result.metadata.length ? <div className="max-h-96 overflow-auto rounded-xl border border-slate-200"><table className="w-full text-left text-xs"><tbody>{result.metadata.map((item) => <tr key={`${item.key}-${item.value}`} className="border-b border-slate-100 last:border-0"><th className="w-1/3 px-3 py-2 font-medium text-slate-600">{item.key}</th><td className="break-all px-3 py-2 text-slate-500">{item.value}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">没有可展示的 EXIF/XMP/IPTC 字段。</p>}</CardContent></Card>
        </div>
      ) : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-800">{value}</p></div> }
