"use client"

import { AlertTriangle, BarChart3, Download, FileSearch, LoaderCircle, Play, RotateCcw, ScanSearch, ShieldQuestion } from "lucide-react"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"

import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { fuseImageDetection, type FusedImageDetection, type PixelDetectionResult } from "@/lib/image-detector-core"
import { inspectImage } from "@/lib/image-inspector"
import type { ImageInspection, ImageSignal } from "@/lib/image-types"

type WorkerMessage = { type: "progress" | "status" | "result" | "error"; progress?: number; file?: string; stage?: string; views?: number; result?: PixelDetectionResult; error?: string }

export function ImageInspectorTool() {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [inspection, setInspection] = useState<ImageInspection | null>(null)
  const [pixel, setPixel] = useState<PixelDetectionResult | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const workerRef = useRef<Worker | null>(null)
  const previewRef = useRef("")
  const runRef = useRef(0)

  useEffect(() => () => { workerRef.current?.terminate(); if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])
  const fused = useMemo(() => pixel && inspection ? fuseImageDetection(pixel, inspection) : null, [pixel, inspection])

  function handleFile(next: File | null) {
    runRef.current += 1
    workerRef.current?.terminate()
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next ? URL.createObjectURL(next) : ""
    setPreviewUrl(previewRef.current); setFile(next); setInspection(null); setPixel(null); setRunning(false); setProgress(0); setStatus(""); setError("")
  }

  async function analyze() {
    if (!file) return
    const runId = ++runRef.current
    setRunning(true); setProgress(2); setStatus(pick("正在并行读取来源证据和准备像素模型", "Reading provenance and preparing the pixel model")); setError(""); setInspection(null); setPixel(null)
    const [inspectionOutcome, pixelOutcome] = await Promise.allSettled([inspectImage(file), runPixelDetection(file)])
    if (runRef.current !== runId) return
    const nextInspection = inspectionOutcome.status === "fulfilled" ? inspectionOutcome.value : null
    const nextPixel = pixelOutcome.status === "fulfilled" ? pixelOutcome.value : null
    setInspection(nextInspection); setPixel(nextPixel); setProgress(100); setStatus(pick("本地分析完成", "Local analysis complete")); setRunning(false)
    if (!nextInspection && !nextPixel) setError(pick("图片检测失败，请刷新页面后重试。", "Image detection failed. Refresh the page and try again."))
    else if (!nextPixel) setError(pick("像素模型未能运行，以下结果仅包含文件来源证据。", "The pixel model could not run. The result below contains file-provenance evidence only."))
    else if (!nextInspection) setError(pick("来源证据读取失败，以下结果仅包含像素模型判断。", "Provenance inspection failed. The result below contains the pixel-model estimate only."))
  }

  function runPixelDetection(source: File) {
    workerRef.current?.terminate()
    const worker = new Worker(new URL("../workers/image-detector.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    return new Promise<PixelDetectionResult>(async (resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (message.type === "progress") {
          setProgress(Math.max(3, Math.min(82, Number(message.progress) * 0.82 || 3)))
          const name = message.file?.split("/").pop()
          setStatus(name ? pick(`正在下载模型文件 ${name}`, `Downloading model file ${name}`) : pick("正在下载本地模型", "Downloading local model"))
        }
        if (message.type === "status") {
          if (message.stage === "decoding-image") { setProgress((value) => Math.max(value, 84)); setStatus(pick("正在解码图片", "Decoding image")) }
          if (message.stage === "analyzing-views") { setProgress(90); setStatus(pick(`正在分析 ${message.views || 1} 个图片区域`, `Analyzing ${message.views || 1} image regions`)) }
        }
        if (message.type === "result" && message.result) resolve(message.result)
        if (message.type === "error") reject(new Error(message.error || "Image model inference failed"))
      }
      worker.onerror = () => reject(new Error("Image detector worker failed to start"))
      try { const buffer = await source.arrayBuffer(); const nav = navigator as Navigator & { gpu?: unknown }; worker.postMessage({ type: "analyze", buffer, mime: source.type, preferWebGpu: Boolean(nav.gpu) }, [buffer]) } catch (reason) { reject(reason) }
    })
  }

  function cancel() { runRef.current += 1; workerRef.current?.terminate(); setRunning(false); setProgress(0); setStatus(pick("已取消", "Cancelled")) }

  function exportReport() {
    if (!pixel && !inspection) return
    const report = { createdAt: new Date().toISOString(), file: file ? { name: file.name, type: file.type, bytes: file.size } : null, conclusion: fused, pixelModel: pixel, provenance: inspection, disclaimer: pick("结果是统计模型与文件证据的组合，不应作为处罚、版权归属或作者身份判断的唯一依据。", "This combines a statistical model with file evidence and must not be the sole basis for penalties, copyright, or authorship decisions.") }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `picokit-image-detection-${Date.now()}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="space-y-6">
    <Card className="border-white/10 bg-[#0d0d0d] shadow-sm">
      <CardHeader><CardTitle className="text-base text-zinc-100">{pick("上传待检测图片", "Choose an image to inspect")}</CardTitle><p className="mt-1.5 text-sm leading-6 text-zinc-500">{pick("像素模型与来源证据会在本地并行分析。首次检测需要下载约 15–30MB 模型。", "The pixel model and provenance evidence run locally in parallel. The first check downloads about 15–30 MB of model files.")}</p></CardHeader>
      <CardContent className="space-y-5"><FileDropzone file={file} onFile={handleFile} disabled={running} />
        {file && previewUrl ? <div className="grid gap-5 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-[160px_minmax(0,1fr)]"><div className="relative h-40 overflow-hidden rounded-lg bg-black"><Image src={previewUrl} alt={pick("待检测图片预览", "Image preview")} fill unoptimized className="object-contain" /></div><div className="flex min-w-0 flex-col justify-center"><p className="truncate text-sm font-medium text-zinc-100">{file.name}</p><p className="mt-1 text-xs text-zinc-500">{formatBytes(file.size)} · {file.type}</p><div className="mt-4 flex flex-wrap gap-3"><Button size="lg" onClick={analyze} disabled={running}><Play />{pick("开始双通道检测", "Run two-channel detection")}</Button>{running ? <Button variant="outline" size="lg" onClick={cancel}><RotateCcw />{pick("取消", "Cancel")}</Button> : null}</div></div></div> : null}
        {running ? <div className="space-y-2"><div className="flex items-center justify-between gap-4 text-xs text-zinc-500"><span className="flex min-w-0 items-center gap-2"><LoaderCircle className="size-3.5 shrink-0 animate-spin text-cyan-300" /><span className="truncate">{status}</span></span><span>{Math.round(progress)}%</span></div><Progress value={progress} /></div> : null}
        {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("部分检测不可用", "Part of the detection is unavailable")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>
    {fused && pixel && inspection ? <DetectionResult fused={fused} pixel={pixel} inspection={inspection} onExport={exportReport} /> : null}
    {!fused && (pixel || inspection) ? <PartialResult pixel={pixel} inspection={inspection} onExport={exportReport} /> : null}
  </div>
}

function DetectionResult({ fused, pixel, inspection, onExport }: { fused: FusedImageDetection; pixel: PixelDetectionResult; inspection: ImageInspection; onExport: () => void }) {
  const { language, pick } = useLanguage(); const aiSignals = inspection.signals.filter((signal) => signal.group === "ai"); const resultCopy = getResultCopy(fused.band, language)
  return <div className="space-y-6"><Card className="overflow-hidden border-white/10 bg-[#0d0d0d]"><div className="grid gap-7 border-b border-white/10 bg-[#101010] p-6 md:grid-cols-[190px_minmax(0,1fr)] md:p-8"><ScoreDial score={pixel.score} label={pick("像素 AI 特征", "Pixel AI pattern")} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={bandClass(fused.band)}>{resultCopy.title}</Badge><Badge variant="outline">{pick("可靠度", "Reliability")}: {reliabilityLabel(fused.reliability, language)}</Badge></div><h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{resultCopy.heading}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{resultCopy.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label={pick("区域一致性", "Region consistency")} value={`${Math.round(pixel.consistency * 100)}%`} /><Metric label={pick("AI 来源信号", "AI provenance signals")} value={`${fused.provenanceSignalCount}`} /><Metric label={pick("推理后端", "Runtime")} value={pixel.backend.toUpperCase()} /></div><Button variant="secondary" className="mt-5" onClick={onExport}><Download />{pick("导出完整 JSON 报告", "Export full JSON report")}</Button></div></div><CardContent className="p-6 md:p-8"><Alert className="border-cyan-300/20 bg-cyan-300/[.05]"><ShieldQuestion /><AlertTitle>{pick("如何理解这个结果", "How to read this result")}</AlertTitle><AlertDescription>{pick("像素概率回答“画面是否像模型训练过的 AI 图片”，来源证据回答“文件是否留下生成工具记录”。两者都可能缺失或误判，因此不输出“100% 确定”。", "The pixel score asks whether the image resembles AI images seen during training; provenance asks whether the file retained generator records. Either can be missing or wrong, so PicoKit never claims 100% certainty.")}</AlertDescription></Alert></CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-2"><Card className="border-white/10 bg-[#0d0d0d]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-cyan-300" />{pick("像素模型分析", "Pixel-model analysis")}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-zinc-500">{pick("模型同时查看整图和多个方形区域。区域分数差异大时，一致性会降低，可能意味着局部编辑、拼接或模型不适配。", "The model checks the full image and several square regions. Large differences reduce consistency and can indicate local edits, composites, or a model-domain mismatch.")}</p><div className="mt-5 space-y-3">{pixel.views.map((view) => <ViewBar key={view.view} name={viewLabel(view.view, language)} score={view.score} />)}</div><p className="mt-5 font-mono text-[11px] text-zinc-600">{pixel.model}</p></CardContent></Card>
      <Card className="border-white/10 bg-[#0d0d0d]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="size-4 text-cyan-300" />{pick("文件来源证据", "File-provenance evidence")}</CardTitle></CardHeader><CardContent>{aiSignals.length ? <div className="space-y-3">{aiSignals.map((signal) => <SignalRow key={signal.id} signal={signal} />)}</div> : <div className="rounded-xl border border-white/10 bg-white/[.02] p-4"><p className="text-sm font-medium text-zinc-200">{pick("未发现明确 AI 来源字段", "No explicit AI provenance field found")}</p><p className="mt-2 text-sm leading-6 text-zinc-500">{pick("截图、社交平台重编码和普通导出都可能删除元数据；没有字段不代表一定来自相机。", "Screenshots, social re-encoding, and ordinary exports can remove metadata. Missing fields do not prove a camera origin.")}</p></div>}<div className="mt-4 grid grid-cols-2 gap-3"><Info label="C2PA" value={inspection.c2pa.present ? inspection.c2pa.validated ? pick("可读取", "Readable") : pick("存在/未完整验证", "Present / unverified") : pick("未检测到", "Not detected")} /><Info label={pick("元数据字段", "Metadata fields")} value={`${inspection.metadata.length}`} /></div></CardContent></Card></div>
    <Card className="border-white/10 bg-[#0d0d0d]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScanSearch className="size-4 text-cyan-300" />{pick("文件详情与原始元数据", "File details and raw metadata")}</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-4"><Info label={pick("格式", "Format")} value={inspection.format} /><Info label={pick("尺寸", "Dimensions")} value={inspection.width ? `${inspection.width} × ${inspection.height}` : pick("无法读取", "Unavailable")} /><Info label={pick("文件大小", "File size")} value={formatBytes(inspection.bytes)} /><Info label={pick("证据一致性", "Evidence agreement")} value={agreementLabel(fused.evidenceAgreement, language)} /></div>{inspection.metadata.length ? <details className="mt-5 rounded-xl border border-white/10"><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-300">{pick(`查看 ${inspection.metadata.length} 个原始字段`, `View ${inspection.metadata.length} raw fields`)}</summary><div className="max-h-80 overflow-auto border-t border-white/10"><table className="w-full text-left text-xs"><tbody>{inspection.metadata.map((item) => <tr key={`${item.key}-${item.value}`} className="border-b border-white/5 last:border-0"><th className="w-1/3 px-4 py-2 font-medium text-zinc-400">{item.key}</th><td className="break-all px-4 py-2 text-zinc-500">{item.value}</td></tr>)}</tbody></table></div></details> : null}</CardContent></Card>
  </div>
}

function PartialResult({ pixel, inspection, onExport }: { pixel: PixelDetectionResult | null; inspection: ImageInspection | null; onExport: () => void }) { const { language, pick } = useLanguage(); return <Card className="border-amber-200 bg-amber-50"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-amber-500" />{pick("仅完成单通道分析", "Single-channel analysis only")}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-zinc-400">{pixel ? pick(`像素模型估计 AI 特征为 ${Math.round(pixel.score * 100)}%，但没有读取到来源证据。`, `The pixel model estimates ${Math.round(pixel.score * 100)}% AI-like patterns, but provenance was unavailable.`) : pick(`已读取 ${inspection?.signals.length || 0} 项文件信号，但像素模型不可用。`, `${inspection?.signals.length || 0} file signals were read, but the pixel model was unavailable.`)}</p>{pixel ? <ViewBar name={pick("整合像素结果", "Combined pixel result")} score={pixel.score} /> : null}{inspection?.signals.map((signal) => <SignalRow key={signal.id} signal={signal} />)}<Button variant="outline" onClick={onExport}><Download />{pick("导出部分报告", "Export partial report")}</Button><p className="text-xs text-zinc-500">{language === "en" ? "Do not treat a partial result as a final origin judgment." : "不要把单通道结果作为最终来源判断。"}</p></CardContent></Card> }

function ScoreDial({ score, label }: { score: number; label: string }) { const degrees = Math.round(score * 360); return <div className="flex flex-col items-center justify-center"><div className="grid size-36 place-items-center rounded-full p-2" style={{ background: `conic-gradient(#67e8f9 ${degrees}deg, rgba(255,255,255,.08) ${degrees}deg)` }}><div className="grid size-full place-items-center rounded-full bg-[#101010] text-center"><div><p className="text-4xl font-semibold tracking-[-.05em] text-white">{Math.round(score * 100)}<span className="text-lg text-zinc-500">%</span></p><p className="mt-1 text-[11px] text-zinc-500">{label}</p></div></div></div></div> }
function ViewBar({ name, score }: { name: string; score: number }) { return <div><div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-zinc-400">{name}</span><span className="font-mono text-zinc-300">{Math.round(score * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.round(score * 100)}%` }} /></div></div> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/10 bg-white/[.025] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p></div> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/10 bg-white/[.02] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium text-zinc-200">{value}</p></div> }
function SignalRow({ signal }: { signal: ImageSignal }) { const { pick } = useLanguage(); return <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="min-w-0"><p className="text-sm font-medium text-zinc-200">{signal.label}</p><p className="mt-1 break-all text-xs text-zinc-500">{signal.value}</p></div><Badge variant={signal.severity === "high" ? "destructive" : "secondary"}>{signal.severity === "high" ? pick("强信号", "Strong") : signal.severity === "medium" ? pick("中等", "Medium") : pick("信息", "Info")}</Badge></div> }

function getResultCopy(band: FusedImageDetection["band"], language: "zh-CN" | "en") { if (language === "en") { if (band === "higher-ai-signals") return { title: "Higher AI signals", heading: "The image contains stronger AI-generation signals", description: "The pixel model, retained provenance, or both point toward AI generation. This is evidence, not proof of authorship or a specific generator." }; if (band === "lower-ai-signals") return { title: "Lower AI signals", heading: "No strong AI-generation pattern was found", description: "The current model found fewer AI-like pixel patterns and no strong provenance trigger. This does not prove that the image is human-made or camera-original." }; return { title: "Uncertain", heading: "The available signals are mixed or too weak", description: "The image falls inside the model's uncertain range. Compression, editing, new generators, illustrations, and unusual camera processing can all affect the result." } } if (band === "higher-ai-signals") return { title: "较高 AI 信号", heading: "图片包含较强的 AI 生成特征", description: "像素模型、保留的来源信息，或两者共同指向 AI 生成。这些是辅助证据，不能证明作者身份或具体生成器。" }; if (band === "lower-ai-signals") return { title: "较低 AI 信号", heading: "暂未发现强 AI 生成特征", description: "当前模型检测到的 AI 像素模式较少，也没有强来源触发信号。这不等于图片一定由人类创作或直接来自相机。" }; return { title: "无法确定", heading: "现有信号混合或强度不足", description: "图片落在模型的不确定区间。压缩、编辑、新型生成器、插画和特殊相机处理都会影响判断。" } }
function bandClass(band: FusedImageDetection["band"]) { return band === "higher-ai-signals" ? "bg-amber-500/15 text-amber-300" : band === "lower-ai-signals" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-zinc-300" }
function reliabilityLabel(value: FusedImageDetection["reliability"], language: "zh-CN" | "en") { const labels = language === "en" ? { high: "High", medium: "Medium", low: "Low" } : { high: "高", medium: "中", low: "低" }; return labels[value] }
function agreementLabel(value: FusedImageDetection["evidenceAgreement"], language: "zh-CN" | "en") { const en = { agree: "Signals agree", conflict: "Signals conflict", "pixel-only": "Pixel only", "provenance-only": "Provenance only", insufficient: "Insufficient" }; const zh = { agree: "信号一致", conflict: "信号冲突", "pixel-only": "仅像素", "provenance-only": "仅来源", insufficient: "证据不足" }; return (language === "en" ? en : zh)[value] }
function viewLabel(value: string, language: "zh-CN" | "en") { const en: Record<string, string> = { full: "Full image", center: "Center", "top-left": "Top left", "top-right": "Top right", "bottom-left": "Bottom left", "bottom-right": "Bottom right" }; const zh: Record<string, string> = { full: "整张图片", center: "中心区域", "top-left": "左上区域", "top-right": "右上区域", "bottom-left": "左下区域", "bottom-right": "右下区域" }; return (language === "en" ? en : zh)[value] || value }
