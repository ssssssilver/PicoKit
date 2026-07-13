"use client"

import { AlertTriangle, BarChart3, Download, LoaderCircle, Play, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

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
      setError("请至少输入约 300 个字符。短文本的检测误差很大，不适合给出分数。")
      return
    }
    workerRef.current?.terminate()
    const worker = new Worker(new URL("../workers/text-detector.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    setRunning(true)
    setProgress(1)
    setStatus("正在初始化本地检测器")
    worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.type === "progress") {
        setProgress(Math.max(2, Number(event.data.progress) || 2))
        setStatus(event.data.file ? `正在下载 ${String(event.data.file).split("/").pop()}` : "正在下载模型")
      }
      if (event.data.type === "status") setStatus(String(event.data.stage || "正在分析"))
      if (event.data.type === "result") {
        setResult(event.data.result as DetectorResult)
        setProgress(100)
        setStatus("分析完成")
        setRunning(false)
      }
      if (event.data.type === "error") {
        setError(String(event.data.error || "检测失败"))
        setRunning(false)
      }
    }
    worker.onerror = () => { setError("本地模型 Worker 启动失败，请刷新后重试。"); setRunning(false) }
    const nav = navigator as Navigator & { gpu?: unknown }
    worker.postMessage({ type: "analyze", text, preferWebGpu: Boolean(nav.gpu) })
  }

  function cancel() {
    workerRef.current?.terminate()
    workerRef.current = null
    setRunning(false)
    setProgress(0)
    setStatus("已取消")
  }

  function exportReport() {
    if (!result) return
    const blob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), textLength: text.length, ...result, disclaimer: "统计模型结果，不可作为处罚或身份判断的唯一依据。" }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `localproof-text-report-${Date.now()}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm shadow-slate-200/50">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle className="text-base">粘贴英文文本</CardTitle><p className="mt-1 text-sm text-slate-500">模型主要针对英文；建议至少 150–200 个英文词。</p></div>
          <div className="text-right text-xs text-slate-500"><p>{count.characters.toLocaleString()} 字符</p><p>{count.words.toLocaleString()} 词</p></div>
        </CardHeader>
        <CardContent>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the text you want to review here…" className="min-h-72 resize-y border-slate-200 bg-slate-50/50 text-base leading-7" disabled={running} />
          {running ? <div className="mt-4 space-y-2"><div className="flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" />{status}</span><span>{Math.round(progress)}%</span></div><Progress value={progress} /></div> : null}
          {error ? <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertTitle>无法检测</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" onClick={analyze} disabled={running}><Play data-icon="inline-start" />开始本地检测</Button>
            {running
              ? <Button variant="outline" size="lg" onClick={cancel}><RotateCcw />取消</Button>
              : <Button variant="outline" size="lg" onClick={() => { setText(""); setResult(null); setError("") }} disabled={!text && !result}><RotateCcw />清空</Button>}
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="grid gap-6 bg-slate-950 p-6 text-white md:grid-cols-[220px_1fr] md:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">AI 风险估计</p>
              <div className="mt-3 text-6xl font-semibold tracking-[-0.06em]">{Math.round(result.score * 100)}<span className="text-2xl text-slate-400">%</span></div>
              <Badge className="mt-4 bg-white/10 text-white">{result.band}</Badge>
            </div>
            <div className="space-y-4">
              <p className="max-w-xl text-sm leading-6 text-slate-300">这是模型对文本模式的统计判断，不是作者身份鉴定。改写、翻译、短文本、专业模板和非英语内容都可能造成误判。</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="结果稳定度" value={`${Math.round(result.confidence * 100)}%`} />
                <Metric label="运行后端" value={result.backend.toUpperCase()} />
                <Metric label="分析片段" value={`${result.segments.length}`} />
              </div>
              <Button variant="secondary" onClick={exportReport}><Download />导出 JSON 报告</Button>
            </div>
          </div>
          <CardContent className="p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-cyan-700" />分段证据</h2>
            <div className="mt-4 space-y-3">
              {result.segments.map((segment, index) => (
                <div key={`${segment.excerpt}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[90px_1fr]">
                  <div><span className="text-xl font-semibold">{Math.round(segment.score * 100)}%</span><p className="text-xs text-slate-400">片段 {index + 1}</p></div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}
