"use client"

import { AlertTriangle, CheckCircle2, Download, LoaderCircle, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { FileDropzone } from "@/components/file-dropzone"
import { ImageCompare } from "@/components/image-compare"
import { downloadBlob } from "@/lib/image-sanitizer"

type WatermarkMeta = {
  applied: boolean
  skipReason: string | null
  size: number | null
  decisionTier: string | null
  passCount: number
  detection?: { adaptiveConfidence?: number | null }
}

async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("图片解码失败"))
    image.src = url
  })
}

async function canvasBlob(canvas: HTMLCanvasElement | OffscreenCanvas) {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: "image/png" })
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("结果编码失败")), "image/png"))
}

export function GeminiWatermarkTool() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState("")
  const [resultUrl, setResultUrl] = useState("")
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [meta, setMeta] = useState<WatermarkMeta | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const urlsRef = useRef<string[]>([])

  useEffect(() => () => { urlsRef.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  function handleFile(next: File | null) {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    const nextUrl = next ? URL.createObjectURL(next) : ""
    if (nextUrl) urlsRef.current.push(nextUrl)
    setFile(next); setSourceUrl(nextUrl); setResultUrl(""); setResultBlob(null); setMeta(null); setError(""); setConfirmed(false)
  }

  async function processImage() {
    if (!file || !sourceUrl || !confirmed) return
    setRunning(true); setError("")
    try {
      const image = await loadImage(sourceUrl)
      const { removeWatermarkFromImage } = await import("@pilio/gemini-watermark-remover/browser")
      const result = await removeWatermarkFromImage(image, { adaptiveMode: "auto" })
      const blob = await canvasBlob(result.canvas as HTMLCanvasElement | OffscreenCanvas)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      const nextResultUrl = URL.createObjectURL(blob)
      urlsRef.current.push(nextResultUrl)
      setResultBlob(blob); setResultUrl(nextResultUrl); setMeta(result.meta as WatermarkMeta)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "水印处理失败") }
    finally { setRunning(false) }
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm"><CardContent className="space-y-4 p-5 sm:p-6"><FileDropzone file={file} onFile={handleFile} disabled={running} />{file ? <><Alert className="border-violet-200 bg-violet-50"><AlertTriangle /><AlertTitle>仅处理受支持的 Gemini 可见角标</AlertTitle><AlertDescription>不处理第三方版权水印，也不声称移除 SynthID 等不可见水印。</AlertDescription></Alert><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} className="mt-1" /><span>我拥有处理这张图片的权利，且目标是 Gemini 生成图片上的可见 AI 角标。</span></label><Button size="lg" onClick={processImage} disabled={!confirmed || running}>{running ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{running ? "正在本地反向混合" : "检测并处理水印"}</Button></> : null}{error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>处理失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}</CardContent></Card>
      {resultUrl && sourceUrl && meta ? <Card className="border-slate-200 shadow-none"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base">{meta.applied ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertTriangle className="size-5 text-amber-600" />}{meta.applied ? "处理完成" : "未确认匹配水印"}</CardTitle><p className="mt-1 text-sm text-slate-500">{meta.applied ? "拖动滑杆检查处理区域。" : `SDK 未应用更改：${meta.skipReason || "未达到安全阈值"}`}</p></div><Badge variant="outline">{meta.decisionTier || "safe-skip"}</Badge></CardHeader><CardContent className="space-y-4"><ImageCompare before={sourceUrl} after={resultUrl} /><div className="grid grid-cols-3 gap-3"><Info label="应用结果" value={meta.applied ? "已应用" : "安全跳过"} /><Info label="水印尺寸" value={meta.size ? `${meta.size}px` : "未识别"} /><Info label="处理轮次" value={`${meta.passCount || 0}`} /></div><Button size="lg" disabled={!resultBlob || !meta.applied} onClick={() => resultBlob && file && downloadBlob(resultBlob, `${file.name.replace(/\.[^.]+$/, "")}-gemini-cleaned.png`)}><Download />下载 PNG 结果</Button></CardContent></Card> : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
