"use client"

import { Download, QrCode, ScanLine } from "lucide-react"
import { useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { downloadBlob, safeError } from "@/lib/browser-files"

type PayloadType = "text" | "url" | "wifi" | "email" | "phone"

const initialPayloads: Record<PayloadType, string> = {
  url: "https://tabnative.modone0622.workers.dev",
  text: "",
  wifi: "",
  email: "",
  phone: "",
}

export function createInitialQrPayloads() {
  return { ...initialPayloads }
}

export function updateQrPayload(payloads: Record<PayloadType, string>, type: PayloadType, value: string) {
  return { ...payloads, [type]: value }
}

export function QrTool() {
  const { pick } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [type, setType] = useState<PayloadType>("url")
  const [payloads, setPayloads] = useState<Record<PayloadType, string>>(createInitialQrPayloads)
  const [secondary, setSecondary] = useState("")
  const [foreground, setForeground] = useState("#111111")
  const [background, setBackground] = useState("#ffffff")
  const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M")
  const [margin, setMargin] = useState(3)
  const [logo, setLogo] = useState<string>("")
  const [decoded, setDecoded] = useState("")
  const [error, setError] = useState("")
  const value = payloads[type]

  function setValue(nextValue: string) {
    setPayloads((current) => updateQrPayload(current, type, nextValue))
  }

  function payload() {
    if (type === "wifi") return `WIFI:T:WPA;S:${escapeQr(value)};P:${escapeQr(secondary)};;`
    if (type === "email") return `mailto:${value}`
    if (type === "phone") return `tel:${value}`
    return value
  }

  async function renderCanvas() {
    if (!value.trim()) throw new Error(pick("请输入内容", "Enter content first"))
    const QRCode = await import("qrcode")
    if (!canvasRef.current) throw new Error(pick("二维码预览不可用", "QR preview is unavailable"))
    await QRCode.toCanvas(canvasRef.current, payload(), { width: 480, margin, errorCorrectionLevel: level, color: { dark: foreground, light: background } })
    resetQrCanvasDisplaySize(canvasRef.current)
    if (logo) await drawLogo(canvasRef.current, logo)
    return canvasRef.current
  }

  async function generate() {
    setError("")
    try { await renderCanvas() }
    catch (reason) { setError(safeError(reason, pick("二维码生成失败", "QR generation failed"))) }
  }

  async function download(format: "png" | "svg") {
    setError("")
    try {
      if (!value.trim()) throw new Error(pick("请输入内容", "Enter content first"))
      const QRCode = await import("qrcode")
      if (format === "svg") {
        let svg = await QRCode.toString(payload(), { type: "svg", width: 480, margin, errorCorrectionLevel: level, color: { dark: foreground, light: background } })
        if (logo) svg = svg.replace("</svg>", `<rect x="185" y="185" width="110" height="110" rx="14" fill="#fff"/><image href="${logo}" x="195" y="195" width="90" height="90" preserveAspectRatio="xMidYMid meet"/></svg>`)
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "tabnative-qr.svg")
      } else {
        const canvas = await renderCanvas()
        canvas.toBlob((blob) => blob && downloadBlob(blob, "tabnative-qr.png"), "image/png")
      }
    } catch (reason) { setError(safeError(reason, pick("下载失败", "Download failed"))) }
  }

  async function decode(file: File | undefined) {
    if (!file) return
    setError(""); setDecoded("")
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) throw new Error(pick("浏览器无法读取图片", "The browser cannot read this image"))
      context.drawImage(bitmap, 0, 0); bitmap.close()
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      if ("BarcodeDetector" in window) {
        const Detector = (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
        const found = await new Detector({ formats: ["qr_code"] }).detect(canvas)
        if (found[0]?.rawValue) { setDecoded(found[0].rawValue); return }
      }
      const jsQR = (await import("jsqr")).default
      const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" })
      if (!result) throw new Error(pick("没有识别到二维码，请换一张更清晰的图片", "No QR code found. Try a clearer image"))
      setDecoded(result.data)
    } catch (reason) { setError(safeError(reason, pick("二维码识别失败", "QR decoding failed"))) }
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("生成二维码", "Generate QR code")}</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <label className="space-y-2 text-sm"><span>{pick("内容类型", "Content type")}</span><select value={type} onChange={(event) => setType(event.target.value as PayloadType)} className="h-9 w-full rounded-lg border border-input bg-transparent px-3"><option value="url">{pick("网址", "URL")}</option><option value="text">{pick("文本", "Text")}</option><option value="wifi">Wi-Fi</option><option value="email">Email</option><option value="phone">{pick("电话", "Phone")}</option></select></label>
        <label className="space-y-2 text-sm"><span>{type === "wifi" ? pick("Wi-Fi 名称", "Wi-Fi name") : pick("内容", "Content")}</span><Input value={value} onChange={(event) => setValue(event.target.value)} /></label>
        {type === "wifi" ? <label className="space-y-2 text-sm"><span>{pick("Wi-Fi 密码", "Wi-Fi password")}</span><Input value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><ColorField label={pick("前景", "Foreground")} value={foreground} setValue={setForeground} /><ColorField label={pick("背景", "Background")} value={background} setValue={setBackground} /><label className="space-y-2 text-sm"><span>{pick("容错", "Error correction")}</span><select value={level} onChange={(event) => setLevel(event.target.value as typeof level)} className="h-9 w-full rounded-lg border border-input bg-transparent px-2"><option>L</option><option>M</option><option>Q</option><option>H</option></select></label><label className="space-y-2 text-sm"><span>{pick("边距", "Margin")}</span><Input type="number" min="0" max="10" value={margin} onChange={(event) => setMargin(Math.max(0, Math.min(10, Number(event.target.value))))} /></label></div>
        <label className="space-y-2 text-sm"><span>{pick("中心 Logo（可选，建议使用 H 容错）", "Center logo (optional; use H correction)")}</span><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) setLogo(""); else { const reader = new FileReader(); reader.onload = () => setLogo(String(reader.result ?? "")); reader.readAsDataURL(file) } }} /></label>
        <div className="flex flex-wrap gap-2"><Button onClick={generate}><QrCode />{pick("生成", "Generate")}</Button><Button variant="outline" onClick={() => download("png")}><Download />PNG</Button><Button variant="outline" onClick={() => download("svg")}><Download />SVG</Button></div>
      </div>
      <div className="grid min-h-64 place-items-center rounded-xl bg-white p-4"><canvas ref={canvasRef} className="h-auto max-w-full" width="480" height="480" aria-label={pick("二维码预览", "QR preview")} /></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{pick("识别二维码图片", "Decode a QR image")}</CardTitle></CardHeader><CardContent className="space-y-4"><label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 text-sm hover:border-cyan-300/40"><ScanLine className="text-cyan-300" />{pick("选择包含二维码的图片", "Choose an image containing a QR code")}<input className="sr-only" type="file" accept="image/*" onChange={(event) => void decode(event.target.files?.[0])} /></label>{decoded ? <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.06] p-4"><p className="text-xs text-zinc-500">{pick("识别结果", "Decoded value")}</p><p className="mt-2 break-all text-sm">{decoded}</p></div> : null}</CardContent></Card>
    {error ? <Alert variant="destructive"><QrCode /><AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </div>
}

function ColorField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) { return <label className="space-y-2 text-sm"><span>{label}</span><Input type="color" value={value} onChange={(event) => setValue(event.target.value)} className="h-9 p-1" /></label> }
function escapeQr(value: string) { return value.replace(/([\\;,:"])/g, "\\$1") }
export function resetQrCanvasDisplaySize(canvas: { style: Pick<CSSStyleDeclaration, "removeProperty"> }) {
  canvas.style.removeProperty("width")
  canvas.style.removeProperty("height")
}
async function drawLogo(canvas: HTMLCanvasElement, source: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const next = new Image(); next.onload = () => resolve(next); next.onerror = reject; next.src = source })
  const context = canvas.getContext("2d"); if (!context) return
  const size = Math.round(canvas.width * .19), x = Math.round((canvas.width - size) / 2), y = Math.round((canvas.height - size) / 2), pad = 10
  context.fillStyle = "#fff"; context.fillRect(x - pad, y - pad, size + pad * 2, size + pad * 2)
  context.drawImage(image, x, y, size, size)
}
