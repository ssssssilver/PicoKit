"use client"

import { AlertTriangle, Download, ImageDown, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { downloadBlob } from "@/lib/image-sanitizer"
import type { TransformOptions } from "@/lib/image-transformer"

type WorkerResult = { ok: boolean; buffer?: ArrayBuffer; mime?: string; width?: number; height?: number; quality?: number; targetReached?: boolean; error?: string }

export function ImageCompressorTool({ targetMode = false }: { targetMode?: boolean }) {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<TransformOptions["format"]>("image/jpeg")
  const [quality, setQuality] = useState(82)
  const [maxEdge, setMaxEdge] = useState(2400)
  const [aspect, setAspect] = useState<TransformOptions["aspect"]>("original")
  const [rotation, setRotation] = useState<TransformOptions["rotation"]>(0)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [grayscale, setGrayscale] = useState(false)
  const [watermarkText, setWatermarkText] = useState("")
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null)
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
      let watermarkPixels: TransformOptions["watermarkImage"]
      if (watermarkImage) {
        const markBitmap = await createImageBitmap(watermarkImage)
        try {
          const longest = Math.max(markBitmap.width, markBitmap.height)
          const scale = Math.min(1, 600 / longest)
          const markCanvas = new OffscreenCanvas(Math.max(1, Math.round(markBitmap.width * scale)), Math.max(1, Math.round(markBitmap.height * scale)))
          const markContext = markCanvas.getContext("2d", { willReadFrequently: true })
          if (markContext) {
            markContext.drawImage(markBitmap, 0, 0, markCanvas.width, markCanvas.height)
            const markData = markContext.getImageData(0, 0, markCanvas.width, markCanvas.height)
            watermarkPixels = { pixels: markData.data, width: markData.width, height: markData.height }
          }
        } finally { markBitmap.close() }
      }
      const options: TransformOptions = { format, quality: quality / 100, maxEdge: maxEdge || undefined, aspect, rotation, flipX, flipY, brightness, contrast, saturation, grayscale, watermarkText, watermarkImage: watermarkPixels, targetBytes: targetMode ? Math.max(10, targetKb) * 1024 : undefined }
      const bitmap = await createImageBitmap(file)
      let pixels: ImageData
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) throw new Error("浏览器无法创建图片画布")
        context.drawImage(bitmap, 0, 0)
        pixels = context.getImageData(0, 0, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
      const buffer = pixels.data.buffer as ArrayBuffer
      const response = await new Promise<WorkerResult>((resolve, reject) => {
        cancelRef.current = reject
        worker.onmessage = (event: MessageEvent<WorkerResult & { id: string }>) => resolve(event.data)
        worker.onerror = () => reject(new Error("图片 Worker 启动失败"))
        worker.postMessage({ id: crypto.randomUUID(), buffer, width: pixels.width, height: pixels.height, options }, [buffer])
      })
      if (!response.ok || !response.buffer || !response.mime) throw new Error(response.error || "图片处理失败")
      setResult({ blob: new Blob([response.buffer], { type: response.mime }), width: response.width || 0, height: response.height || 0, quality: response.quality || 0, targetReached: Boolean(response.targetReached) })
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(pick(reason instanceof Error ? reason.message : "处理失败", "Image processing failed. Try a smaller image or another output format."))
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
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <FileDropzone file={file} onFile={handleFile} disabled={running} />
          {file ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={pick("输出格式", "Output format")}><select value={format} onChange={(event) => setFormat(event.target.value as TransformOptions["format"])} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></Field>
              <Field label={pick("最大边（像素）", "Longest edge (pixels)")}><Input type="number" min="320" max="12000" value={maxEdge} onChange={(event) => setMaxEdge(Number(event.target.value))} /></Field>
              <Field label={pick("裁切比例", "Crop ratio")}><select value={aspect} onChange={(event) => setAspect(event.target.value as TransformOptions["aspect"])} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="original">{pick("保持原图", "Keep original")}</option><option value="1:1">1:1 {pick("居中裁切", "center crop")}</option><option value="4:3">4:3 {pick("居中裁切", "center crop")}</option><option value="16:9">16:9 {pick("居中裁切", "center crop")}</option></select></Field>
              <Field label={pick("旋转", "Rotation")}><select value={rotation} onChange={(event) => setRotation(Number(event.target.value) as TransformOptions["rotation"])} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="0">{pick("不旋转", "No rotation")}</option><option value="90">{pick("顺时针", "Clockwise")} 90°</option><option value="180">180°</option><option value="270">{pick("逆时针", "Counterclockwise")} 90°</option></select></Field>
              <Field label={pick("翻转", "Flip")}><div className="flex h-10 items-center gap-4 rounded-lg border border-input px-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={flipX} onChange={(event) => setFlipX(event.target.checked)} />{pick("水平", "Horizontal")}</label><label className="flex items-center gap-2"><input type="checkbox" checked={flipY} onChange={(event) => setFlipY(event.target.checked)} />{pick("垂直", "Vertical")}</label></div></Field>
              <Field label={`${pick("亮度", "Brightness")} ${brightness}%`}><Input type="range" min="50" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} className="px-0" /></Field>
              <Field label={`${pick("对比度", "Contrast")} ${contrast}%`}><Input type="range" min="50" max="150" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} className="px-0" /></Field>
              <Field label={`${pick("饱和度", "Saturation")} ${saturation}%`}><Input type="range" min="0" max="200" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} className="px-0" /></Field>
              <Field label={pick("文字水印", "Text watermark")}><Input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} placeholder={pick("留空则不添加", "Leave blank for none")} /></Field>
              <Field label={pick("图片 / Logo 水印", "Image / logo watermark")}><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setWatermarkImage(event.target.files?.[0] ?? null)} /></Field>
              <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={grayscale} onChange={(event) => setGrayscale(event.target.checked)} />{pick("转换为灰度图", "Convert to grayscale")}</label>
              {targetMode ? <Field label={pick("目标大小（KB）", "Target size (KB)")}><Input type="number" min="10" max="10000" value={targetKb} onChange={(event) => setTargetKb(Number(event.target.value))} /></Field> : <Field label={`${pick("质量", "Quality")} ${quality}%`}><Input type="range" min="20" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="px-0" /></Field>}
              <div className="flex items-end gap-2"><Button size="lg" className="flex-1" onClick={process} disabled={running || (targetMode && format === "image/png")}>{running ? <LoaderCircle className="animate-spin" /> : <ImageDown />}{running ? pick("正在本地编码", "Encoding locally") : targetMode ? pick("压缩到目标大小", "Compress to target") : pick("转换并压缩", "Convert and compress")}</Button>{running ? <Button size="lg" variant="outline" onClick={cancel}>{pick("取消", "Cancel")}</Button> : null}</div>
            </div>
          ) : null}
          {targetMode && format === "image/png" ? <Alert className="mt-4 border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>{pick("PNG 无法稳定按质量压缩", "PNG cannot be reliably compressed by quality")}</AlertTitle><AlertDescription>{pick("目标 KB 模式请使用 JPG 或 WebP；PNG 可在普通压缩页调整尺寸。", "Use JPG or WebP for target-KB mode. Resize PNG images on the standard compressor page.")}</AlertDescription></Alert> : null}
          {error ? <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertTitle>{pick("处理失败", "Processing failed")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>
      {result && file ? (
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-none">
          <CardHeader><CardTitle className="text-base">{pick("处理完成", "Processing complete")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-5"><Info label={pick("原文件", "Original")} value={formatBytes(file.size)} /><Info label={pick("结果", "Result")} value={formatBytes(result.blob.size)} /><Info label={pick("输出格式", "Output format")} value={extension.toUpperCase()} /><Info label={pick("结果尺寸", "Dimensions")} value={`${result.width} × ${result.height}`} /><Info label={pick("节省", "Saved")} value={`${Math.max(0, Math.round((1 - result.blob.size / file.size) * 100))}%`} /></div>
            {targetMode && !result.targetReached ? <Alert className="border-amber-200 bg-amber-50"><AlertTriangle /><AlertTitle>{pick("未完全达到目标", "Target not fully reached")}</AlertTitle><AlertDescription>{pick("在最低质量与安全缩放范围内输出了最接近的结果。", "The closest result was produced within the minimum-quality and safe-scaling limits.")}</AlertDescription></Alert> : null}
            <Button size="lg" onClick={() => downloadBlob(result.blob, `${file.name.replace(/\.[^.]+$/, "")}-tabnative.${extension}`)}><Download />{pick("下载", "Download")} {extension.toUpperCase()}</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
