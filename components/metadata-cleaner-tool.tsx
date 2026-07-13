"use client"

import { AlertTriangle, CheckCircle2, Download, Eraser, FileArchive, LoaderCircle, ScanSearch } from "lucide-react"
import { useEffect, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { inspectImage } from "@/lib/image-inspector"
import { downloadBlob, sanitizeImage } from "@/lib/image-sanitizer"
import type { ImageInspection, SanitizeMode, SanitizeResult } from "@/lib/image-types"

const copy: Record<SanitizeMode, { action: string; empty: string; warning: string }> = {
  ai: { action: "清理 AI 元数据", empty: "没有发现已知 AI 生成器或工作流字段", warning: "会移除命中的 AI 生成器/XMP/IPTC 段；复杂混合段可能同时包含其他描述字段。" },
  c2pa: { action: "清理 C2PA", empty: "没有发现 C2PA/JUMBF 容器信号", warning: "C2PA 是来源凭证。清理前建议保留原文件；操作不会删除 SynthID 等像素水印。" },
  label: { action: "清理 AI 标签信号", empty: "没有发现 DigitalSourceType 或 Made with AI 字段", warning: "平台可能同时使用像素分类器；清理元数据不能保证平台标签消失。" },
  all: { action: "清理全部可移除元数据", empty: "没有发现可移除元数据", warning: "会移除 EXIF/XMP/IPTC/C2PA 等容器数据，但尽量保留 ICC 色彩配置。" },
}

export function MetadataCleanerTool({ mode }: { mode: SanitizeMode }) {
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<ImageInspection | null>(null)
  const [postInspection, setPostInspection] = useState<ImageInspection | null>(null)
  const [result, setResult] = useState<SanitizeResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!file) return
    let cancelled = false
    inspectImage(file).then((value) => { if (!cancelled) setInspection(value) }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "解析失败") }).finally(() => { if (!cancelled) setRunning(false) })
    return () => { cancelled = true }
  }, [file])

  function handleFile(next: File | null) {
    setFile(next); setInspection(null); setPostInspection(null); setResult(null); setConfirmed(false); setError(""); setRunning(Boolean(next))
  }

  async function clean() {
    if (!file || !confirmed) return
    setRunning(true); setError(""); setResult(null)
    try {
      const cleaned = await sanitizeImage(file, mode)
      setResult(cleaned)
      const cleanedFile = new File([cleaned.blob], file.name, { type: cleaned.blob.type })
      setPostInspection(await inspectImage(cleanedFile))
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "清理失败") }
    finally { setRunning(false) }
  }

  const expectedSignals = inspection?.signals.filter((signal) => mode === "c2pa" ? signal.group === "c2pa" : mode === "all" || signal.group === "ai" || signal.group === "software") ?? []

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm"><CardContent className="p-5 sm:p-6"><FileDropzone file={file} onFile={handleFile} disabled={running} />{running && !result ? <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />正在本地读取文件容器…</p> : null}{error ? <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertTitle>处理失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}</CardContent></Card>

      {inspection ? (
        <Card className="border-slate-200 shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScanSearch className="size-4 text-cyan-700" />清理前预览</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Info label="格式" value={inspection.format} /><Info label="大小" value={formatBytes(inspection.bytes)} /><Info label="元数据" value={`${inspection.metadata.length} 项`} /><Info label="目标信号" value={`${expectedSignals.length} 项`} /></div>
            {expectedSignals.length ? <div className="space-y-2">{expectedSignals.map((signal) => <div key={signal.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"><div><p className="text-sm font-medium">{signal.label}</p><p className="mt-0.5 text-xs text-slate-500">{signal.value}</p></div><Badge variant="outline">将处理</Badge></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{copy[mode].empty}。你仍可执行容器级复检/清理。</p>}
            <Alert className="border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>处理边界</AlertTitle><AlertDescription>{copy[mode].warning}</AlertDescription></Alert>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} className="mt-1" /><span>我拥有处理此文件的权利，理解来源字段清理不等于改变图片真实来源，并会自行保留需要的原文件。</span></label>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={clean} disabled={!confirmed || running}>{running ? <LoaderCircle className="animate-spin" /> : <Eraser />}{copy[mode].action}</Button>
              {file ? <Button size="lg" variant="outline" onClick={() => downloadBlob(file, `backup-${file.name}`)}><FileArchive />下载原文件备份</Button> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-emerald-900"><CheckCircle2 className="size-5" />本地清理完成</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4"><Info label="移除容器" value={`${result.removed.length} 类`} /><Info label="像素载荷" value={result.pixelsPreserved ? "哈希一致" : "需要复核"} /><Info label="复检信号" value={postInspection ? `${postInspection.signals.filter((signal) => signal.group === "ai" || signal.group === "c2pa").length} 项` : "复检中"} /><Info label="结果大小" value={formatBytes(result.blob.size)} /></div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4"><p className="text-xs font-medium uppercase tracking-[0.15em] text-emerald-700">已处理</p><p className="mt-2 text-sm text-slate-600">{result.removed.length ? result.removed.join("、") : "没有发现匹配的容器段，输出与原容器等价。"}</p><p className="mt-3 break-all font-mono text-[10px] text-slate-400">Pixel payload SHA-256: {result.afterPayloadHash}</p></div>
            {!result.pixelsPreserved ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>像素载荷校验未通过</AlertTitle><AlertDescription>不要使用这个结果；请保留原文件并提交格式样本。</AlertDescription></Alert> : null}
            <Button size="lg" onClick={() => file && downloadBlob(result.blob, `${file.name.replace(/\.[^.]+$/, "")}-${mode}-cleaned.${extensionFor(result.blob.type)}`)} disabled={!result.pixelsPreserved}><Download />下载清理结果</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div> }
function extensionFor(mime: string) { return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp" }
