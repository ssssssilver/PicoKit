"use client"

import { Download, Film, Images, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { canvasToBlob, downloadBlob, safeError } from "@/lib/browser-files"

export function GifTool() {
  const { pick, format } = useLanguage()
  const [gifFile, setGifFile] = useState<File | null>(null), [images, setImages] = useState<File[]>([])
  const [delay, setDelay] = useState(300), [width, setWidth] = useState(640)
  const [running, setRunning] = useState(false), [error, setError] = useState("")

  async function extract() {
    if (!gifFile) return
    setRunning(true); setError("")
    try {
      const [{ parseGIF, decompressFrames }, { default: JSZip }] = await Promise.all([import("gifuct-js"), import("jszip")])
      const parsed = parseGIF(await gifFile.arrayBuffer()), frames = decompressFrames(parsed, true)
      if (frames.length > 300) throw new Error(pick("GIF 超过 300 帧，请先缩短动画", "GIFs are limited to 300 frames"))
      const canvas = document.createElement("canvas"); canvas.width = parsed.lsd.width; canvas.height = parsed.lsd.height
      const context = canvas.getContext("2d")!; const zip = new JSZip()
      for (let index = 0; index < frames.length; index++) { const frame = frames[index], patch = document.createElement("canvas"); patch.width = frame.dims.width; patch.height = frame.dims.height; patch.getContext("2d")!.putImageData(new ImageData(Uint8ClampedArray.from(frame.patch), frame.dims.width, frame.dims.height), 0, 0); context.drawImage(patch, frame.dims.left, frame.dims.top); zip.file(`frame-${String(index + 1).padStart(3, "0")}.png`, await canvasToBlob(canvas)) }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "tabnative-gif-frames.zip")
    } catch (reason) { setError(safeError(reason, pick("GIF 拆帧失败", "GIF extraction failed"))) }
    finally { setRunning(false) }
  }

  async function create() {
    if (images.length < 2) return
    setRunning(true); setError("")
    try {
      if (images.length > 100) throw new Error(pick("最多合成 100 张图片", "Use no more than 100 images"))
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc"), loaded = await Promise.all(images.map(loadImage))
      const targetWidth = Math.min(1200, Math.max(64, width)), targetHeight = Math.max(1, Math.round(targetWidth * loaded[0].height / loaded[0].width))
      if (targetWidth * targetHeight * images.length > 80_000_000) throw new Error(pick("总像素过大，请减少图片或输出宽度", "Reduce the frame count or width"))
      const canvas = document.createElement("canvas"); canvas.width = targetWidth; canvas.height = targetHeight; const context = canvas.getContext("2d", { willReadFrequently: true })!, gif = GIFEncoder()
      for (const image of loaded) { context.fillStyle = "white"; context.fillRect(0, 0, targetWidth, targetHeight); const scale = Math.min(targetWidth / image.width, targetHeight / image.height), w = image.width * scale, h = image.height * scale; context.drawImage(image, (targetWidth - w) / 2, (targetHeight - h) / 2, w, h); const rgba = context.getImageData(0, 0, targetWidth, targetHeight).data, palette = quantize(rgba, 256); gif.writeFrame(applyPalette(rgba, palette), targetWidth, targetHeight, { palette, delay, repeat: 0 }) }
      gif.finish(); const encoded = Uint8Array.from(gif.bytes()); downloadBlob(new Blob([encoded.buffer], { type: "image/gif" }), "tabnative-animation.gif")
    } catch (reason) { setError(safeError(reason, pick("GIF 合成失败", "GIF creation failed"))) }
    finally { setRunning(false) }
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("GIF 拆帧", "Extract GIF frames")}</CardTitle></CardHeader><CardContent className="space-y-4"><Picker accept="image/gif" label={gifFile?.name ?? pick("选择 GIF 文件", "Choose a GIF file")} onChange={(files) => setGifFile(files?.[0] ?? null)} /><Button onClick={extract} disabled={!gifFile || running}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{pick("导出 PNG 帧 ZIP", "Export PNG frames as ZIP")}</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>{pick("图片合成 GIF", "Create GIF from images")}</CardTitle></CardHeader><CardContent className="space-y-4"><Picker accept="image/png,image/jpeg,image/webp" multiple label={images.length ? format("已选择 {count} 张图片", "{count} images selected", { count: images.length }) : pick("按顺序选择多张图片", "Choose images in frame order")} onChange={(files) => setImages(Array.from(files ?? []))} /><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm"><span>{pick("每帧时长", "Frame delay")} {delay}ms</span><Input type="range" min="50" max="2000" step="50" value={delay} onChange={(e) => setDelay(Number(e.target.value))} /></label><label className="space-y-2 text-sm"><span>{pick("输出宽度", "Output width")}</span><Input type="number" min="64" max="1200" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label></div><Button onClick={create} disabled={images.length < 2 || running}><Film />{pick("合成并下载 GIF", "Create and download GIF")}</Button></CardContent></Card>
    {error ? <Alert variant="destructive"><Film /><AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </div>
}

function Picker({ accept, multiple, label, onChange }: { accept: string; multiple?: boolean; label: string; onChange: (files: FileList | null) => void }) { return <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 text-sm hover:border-cyan-300/40"><Images className="text-cyan-300" />{label}<input className="sr-only" type="file" accept={accept} multiple={multiple} onChange={(e) => onChange(e.target.files)} /></label> }
async function loadImage(file: File) { const url = URL.createObjectURL(file); try { return await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url }) } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000) } }
