"use client"

/* eslint-disable @next/next/no-img-element -- previews use local object URLs that Next Image cannot optimize. */

import { Download, ImageIcon, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { canvasToBlob, downloadBlob, safeError } from "@/lib/browser-files"

const sizes = [16, 32, 48, 180, 192, 512]

export function FaviconTool() {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [background, setBackground] = useState("#0f172a")
  const [padding, setPadding] = useState(10)
  const [rounded, setRounded] = useState(18)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { const url = file ? URL.createObjectURL(file) : ""; const timer = window.setTimeout(() => setPreview(url), 0); return () => { window.clearTimeout(timer); if (url) URL.revokeObjectURL(url) } }, [file])

  async function generate() {
    if (!file) return
    setRunning(true); setError("")
    try {
      const JSZip = (await import("jszip")).default
      const image = await loadImage(file)
      const zip = new JSZip(); const pngs: Array<{ size: number; bytes: Uint8Array }> = []
      for (const size of sizes) {
        const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size
        const context = canvas.getContext("2d"); if (!context) continue
        const radius = size * rounded / 100
        roundRect(context, 0, 0, size, size, radius); context.fillStyle = background; context.fill()
        const inset = size * padding / 100; const target = size - inset * 2
        const scale = Math.min(target / image.width, target / image.height)
        const width = image.width * scale; const height = image.height * scale
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
        const blob = await canvasToBlob(canvas); const bytes = new Uint8Array(await blob.arrayBuffer())
        pngs.push({ size, bytes }); zip.file(size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`, blob)
      }
      zip.file("favicon.ico", makeIco(pngs.filter((item) => item.size <= 48)))
      zip.file("site.webmanifest", JSON.stringify({ name: "My App", short_name: "App", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }], display: "standalone", background_color: background, theme_color: background }, null, 2))
      zip.file("html-snippet.txt", '<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">')
      downloadBlob(await zip.generateAsync({ type: "blob" }), "tabnative-favicon-pack.zip")
    } catch (reason) { setError(safeError(reason, pick("图标生成失败", "Icon generation failed"))) }
    finally { setRunning(false) }
  }

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("Favicon 与应用图标", "Favicon and app icons")}</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-[1fr_280px]">
    <div className="space-y-4"><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 hover:border-cyan-300/40"><ImageIcon className="mb-2 text-cyan-300" /><span className="text-sm">{file ? file.name : pick("选择 PNG、JPG、WebP 或 SVG", "Choose PNG, JPG, WebP, or SVG")}</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError("") }} /></label>
      <div className="grid grid-cols-3 gap-3"><label className="space-y-2 text-sm"><span>{pick("背景色", "Background")}</span><Input type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="h-9 p-1" /></label><label className="space-y-2 text-sm"><span>{pick("安全边距", "Safe padding")} {padding}%</span><Input type="range" min="0" max="30" value={padding} onChange={(event) => setPadding(Number(event.target.value))} /></label><label className="space-y-2 text-sm"><span>{pick("圆角", "Corner radius")} {rounded}%</span><Input type="range" min="0" max="50" value={rounded} onChange={(event) => setRounded(Number(event.target.value))} /></label></div>
      <Button size="lg" onClick={generate} disabled={!file || running}>{running ? <LoaderCircle className="animate-spin" /> : <Download />}{pick("生成并下载 ZIP", "Generate and download ZIP")}</Button></div>
    <div className="grid min-w-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[#0b0d10] p-4"><div className="grid w-full min-w-0 grid-cols-3 items-end gap-2">{[32,64,128].map((size) => <div key={size} className="min-w-0 text-center"><div className="mx-auto aspect-square w-full max-w-20 overflow-hidden ring-1 ring-white/10" style={{ background, borderRadius: `${rounded}%`, padding: `${padding}%` }}>{preview ? <img src={preview} alt="" className="block h-full w-full max-w-full object-contain" /> : null}</div><span className="mt-2 block text-[10px] text-white/60">{size}px</span></div>)}</div></div>
  </CardContent></Card>{error ? <Alert variant="destructive"><ImageIcon /><AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}</div>
}

async function loadImage(file: File) { const url = URL.createObjectURL(file); try { return await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url }) } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000) } }
function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) { context.beginPath(); context.roundRect(x, y, width, height, radius) }
export function makeIco(images: Array<{ size: number; bytes: Uint8Array }>) {
  const header = 6 + images.length * 16; const total = header + images.reduce((sum, image) => sum + image.bytes.length, 0)
  const output = new Uint8Array(total); const view = new DataView(output.buffer)
  view.setUint16(2, 1, true); view.setUint16(4, images.length, true)
  let offset = header
  images.forEach((image, index) => { const entry = 6 + index * 16; output[entry] = image.size === 256 ? 0 : image.size; output[entry + 1] = output[entry]; view.setUint16(entry + 4, 1, true); view.setUint16(entry + 6, 32, true); view.setUint32(entry + 8, image.bytes.length, true); view.setUint32(entry + 12, offset, true); output.set(image.bytes, offset); offset += image.bytes.length })
  return output
}
