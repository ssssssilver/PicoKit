"use client"

import { AlertTriangle, Download, ImageDown, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { downloadBlob } from "@/lib/image-sanitizer"
import type { TransformOptions } from "@/lib/image-transformer"

type WorkerResult = { ok: boolean; buffer?: ArrayBuffer; mime?: string; width?: number; height?: number; quality?: number; targetReached?: boolean; error?: string }

export function ImageCompressorTool({ targetMode = false }: { targetMode?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<TransformOptions["format"]>("image/jpeg")
  const [quality, setQuality] = useState(82)
  const [maxEdge, setMaxEdge] = useState(2400)
  const [aspect, setAspect] = useState<TransformOptions["aspect"]>("original")
  const [rotation, setRotation] = useState<TransformOptions["rotation"]>(0)
  const [targetKb, setTargetKb] = useState(200)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ blob: Blob; width: number; height: number; quality: number; targetReached: boolean } | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const cancelRef = useRef<((reason: Error) => void) | null>(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  function handleFile(next: File | null) { setFile(next); setResult(null); setError("") }

  async function process() {
    if (!file) return
    setRunning(true); setError(""); setResult(null)
    const worker = new Worker(new URL("../workers/image-transform.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    try {
      const buffer = await file.arrayBuffer()
      const options: TransformOptions = { format, quality: quality / 100, maxEdge: maxEdge || undefined, aspect, rotation, targetBytes: targetMode ? Math.max(10, targetKb) * 1024 : undefined }
      const response = await new Promise<WorkerResult>((resolve, reject) => {
        cancelRef.current = reject
        worker.onmessage = (event: MessageEvent<WorkerResult & { id: string }>) => resolve(event.data)
        worker.onerror = () => reject(new Error("图片 Worker 启动失败"))
        worker.postMessage({ id: crypto.randomUUID(), buffer, mime: file.type, options }, [buffer])
      })
      if (!response.ok || !response.buffer || !response.mime) throw new Error(response.error || "图片处理失败")
      setResult({ blob: new Blob([response.buffer], { type: response.mime }), width: response.width || 0, height: response.height || 0, quality: response.quality || 0, targetReached: Boolean(response.targetReached) })
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "处理失败")
    }
    finally { worker.terminate(); workerRef.current = null; cancelRef.current = null; setRunning(false) }
  }

  function cancel() {
    workerRef.current?.terminate()
    cancelRef.current?.(new DOMException("已取消", "AbortError"))
  }

  const extension = format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp"

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm"><CardContent className="p-5 sm:p-6"><FileDropzone file={file} onFile={handleFile} disabled={running} />{file ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="输出格式"><select value={format} onChange={(event) => setFormat(event.target.value as TransformOptions["format"])} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></Field><Field label="最大边（像素）"><Input type="number" min="320" max="12000" value={maxEdge} onChange={(event) => setMaxEdge(Number(event.target.value))} /></Field><Field label="裁切比例"><select value={aspect} onChange={(event) => setAspect(event.target.value as TransformOptions["aspect"])} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="original">保持原图</option><option value="1:1">1:1 居中裁切</option><option value="4:3">4:3 居中裁切</option><option value="16:9">16:9 居中裁切</option></select></Field><Field label="旋转"><select value={rotation} onChange={(event) => setRotation(Number(event.target.value) as TransformOptions["rotation"])} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="0">不旋转</option><option value="90">顺时针 90°</option><option value="180">180°</option><option value="270">逆时针 90°</option></select></Field>{targetMode ? <Field label="目标大小（KB）"><Input type="number" min="10" max="10000" value={targetKb} onChange={(event) => setTargetKb(Number(event.target.value))} /></Field> : <Field label={`质量 ${quality}%`}><Input type="range" min="20" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="px-0" /></Field>}<div className="flex items-end gap-2"><Button size="lg" className="flex-1" onClick={process} disabled={running || (targetMode && format === "image/png")}>{running ? <LoaderCircle className="animate-spin" /> : <ImageDown />}{running ? "正在本地编码" : targetMode ? "压缩到目标大小" : "转换并压缩"}</Button>{running ? <Button size="lg" variant="outline" onClick={cancel}>取消</Button> : null}</div></div> : null}{targetMode && format === "image/png" ? <Alert className="mt-4 border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>PNG 无法稳定按质量压缩</AlertTitle><AlertDescription>目标 KB 模式请使用 JPG 或 WebP；PNG 可在普通压缩页调整尺寸。</AlertDescription></Alert> : null}{error ? <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertTitle>处理失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}</CardContent></Card>
      {result && file ? <Card className="border-emerald-200 bg-emerald-50/30 shadow-none"><CardHeader><CardTitle className="text-base">处理完成</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-5"><Info label="原文件" value={formatBytes(file.size)} /><Info label="结果" value={formatBytes(result.blob.size)} /><Info label="输出格式" value={extension.toUpperCase()} /><Info label="结果尺寸" value={`${result.width} × ${result.height}`} /><Info label="节省" value={`${Math.max(0, Math.round((1 - result.blob.size / file.size) * 100))}%`} /></div>{targetMode && !result.targetReached ? <Alert className="border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>未完全达到目标</AlertTitle><AlertDescription>在最低质量与安全缩放范围内输出了最接近的结果。</AlertDescription></Alert> : null}<Button size="lg" onClick={() => downloadBlob(result.blob, `${file.name.replace(/\.[^.]+$/, "")}-localproof.${extension}`)}><Download />下载 {extension.toUpperCase()}</Button></CardContent></Card> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
