"use client"

import { AlertTriangle, BarChart3, Download, LoaderCircle, Play, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

type DetectorResult = {
  score: number
  confidence: number
  backend: string
  model: string
  band: string
  segments: Array<{ excerpt: string; score: number; characters: number }>
}

export function TextDetectorTool() {
  const { language, pick } = useLanguage()
  const [text, setText] = useState("")
  const [status, setStatus] = useState("")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState<DetectorResult | null>(null)
  const [running, setRunning] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  const count = useMemo(() => ({ characters: text.length, words: text.trim() ? text.trim().split(/\s+/).length : 0 }), [text])

  function analyze() {
    setError("")
    setResult(null)
    if (text.trim().length < 300) {
      setError(pick("请至少输入约 300 个字符。短文本的检测误差很大，不适合给出分数。", "Enter at least about 300 characters. Short text has too much detection error for a meaningful score."))
      return
    }
    workerRef.current?.terminate()
    const worker = new Worker(new URL("../workers/text-detector.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    setRunning(true)
    setProgress(1)
    setStatus(pick("正在初始化本地检测器", "Initializing the local detector"))
    worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.type === "progress") {
        setProgress(Math.max(2, Number(event.data.progress) || 2))
        setStatus(event.data.file ? pick(`正在下载 ${String(event.data.file).split("/").pop()}`, `Downloading ${String(event.data.file).split("/").pop()}`) : pick("正在下载模型", "Downloading model"))
      }
      if (event.data.type === "status") setStatus(language === "en" ? "Analyzing locally" : String(event.data.stage || "正在分析"))
      if (event.data.type === "result") {
        setResult(event.data.result as DetectorResult)
        setProgress(100)
        setStatus(pick("分析完成", "Analysis complete"))
        setRunning(false)
      }
      if (event.data.type === "error") {
        setError(language === "en" ? "Detection failed. Refresh the page and try again." : String(event.data.error || "检测失败"))
        setRunning(false)
      }
    }
    worker.onerror = () => { setError(pick("本地模型 Worker 启动失败，请刷新后重试。", "The local model worker failed to start. Refresh the page and try again.")); setRunning(false) }
    const nav = navigator as Navigator & { gpu?: unknown }
    worker.postMessage({ type: "analyze", text, preferWebGpu: Boolean(nav.gpu) })
  }

  function cancel() {
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(false)
    setProgress(0)
    setStatus(pick("已取消", "Cancelled"))
  }

  function exportReport() {
    if (!result) return
    const blob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), textLength: text.length, ...result, disclaimer: pick("统计模型结果，不可作为处罚或身份判断的唯一依据。", "This statistical model result must not be the sole basis for penalties or identity judgments.") }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `picokit-text-report-${Date.now()}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm shadow-slate-200/50">
        <CardHeader className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
          <div className="min-w-0">
            <CardTitle className="text-base text-zinc-100">{pick("粘贴英文文本", "Paste English text")}</CardTitle>
            <p className="mt-1.5 text-sm leading-6 text-zinc-500">{pick("模型主要针对英文，建议输入至少 150–200 个英文词。", "The model is designed mainly for English. Enter at least 150–200 words.")}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto" aria-label={pick("文本统计", "Text statistics")}>
            <TextCount value={count.characters} label={pick("字符数", "Characters")} />
            <TextCount value={count.words} label={pick("英文词数", "Words")} />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={pick("粘贴需要检测的英文文本…", "Paste the English text you want to review…")} className="min-h-72 resize-y border-white/10 bg-white/[.02] px-3.5 py-3 text-base leading-7 placeholder:text-zinc-600" disabled={running} />
          {running ? <div className="mt-4 space-y-2"><div className="flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" />{status}</span><span>{Math.round(progress)}%</span></div><Progress value={progress} /></div> : null}
          {error ? <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertTitle>{pick("无法检测", "Unable to detect")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" onClick={analyze} disabled={running}><Play data-icon="inline-start" />{pick("开始本地检测", "Start local detection")}</Button>
            {running
              ? <Button variant="outline" size="lg" onClick={cancel}><RotateCcw />{pick("取消", "Cancel")}</Button>
              : <Button variant="outline" size="lg" onClick={() => { setText(""); setResult(null); setError("") }} disabled={!text && !result}><RotateCcw />{pick("清空", "Clear")}</Button>}
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="grid gap-6 bg-slate-950 p-6 text-white md:grid-cols-[220px_1fr] md:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{pick("AI 风险估计", "AI risk estimate")}</p>
              <div className="mt-3 text-6xl font-semibold tracking-[-0.06em]">{Math.round(result.score * 100)}<span className="text-2xl text-slate-400">%</span></div>
              <Badge className="mt-4 bg-white/10 text-white">{localizedBand(result.score, result.band, language)}</Badge>
            </div>
            <div className="space-y-4">
              <p className="max-w-xl text-sm leading-6 text-slate-300">{pick("这是模型对文本模式的统计判断，不是作者身份鉴定。改写、翻译、短文本、专业模板和非英语内容都可能造成误判。", "This is a statistical judgment about text patterns, not proof of authorship. Rewriting, translation, short text, professional templates, and non-English content can all cause false results.")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label={pick("结果稳定度", "Result stability")} value={`${Math.round(result.confidence * 100)}%`} />
                <Metric label={pick("运行后端", "Runtime backend")} value={result.backend.toUpperCase()} />
                <Metric label={pick("分析片段", "Segments analyzed")} value={`${result.segments.length}`} />
              </div>
              <Button variant="secondary" onClick={exportReport}><Download />{pick("导出 JSON 报告", "Export JSON report")}</Button>
            </div>
          </div>
          <CardContent className="p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-cyan-700" />{pick("分段证据", "Segment evidence")}</h2>
            <div className="mt-4 space-y-3">
              {result.segments.map((segment, index) => (
                <div key={`${segment.excerpt}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[90px_1fr]">
                  <div><span className="text-xl font-semibold">{Math.round(segment.score * 100)}%</span><p className="text-xs text-slate-400">{pick("片段", "Segment")} {index + 1}</p></div>
                  <p className="text-sm leading-6 text-slate-600">{segment.excerpt}…</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function localizedBand(score: number, fallback: string, language: "zh-CN" | "en") {
  if (language !== "en") return fallback
  if (score >= 0.7) return "Higher AI-pattern risk"
  if (score >= 0.4) return "Uncertain / mixed"
  return "Lower AI-pattern risk"
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}

function TextCount({ value, label }: { value: number; label: string }) {
  return <div className="min-w-0 rounded-lg border border-white/10 bg-white/[.025] px-3 py-2.5 text-right sm:min-w-20"><p className="text-lg font-semibold leading-none tabular-nums text-zinc-100">{value.toLocaleString()}</p><p className="mt-1.5 whitespace-nowrap text-[11px] leading-none text-zinc-500">{label}</p></div>
}
