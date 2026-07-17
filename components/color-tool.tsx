"use client"

import { Copy, Eye, ImageIcon, Palette } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type EyeDropperConstructor = new () => { open: () => Promise<{ sRGBHex: string }> }

export function ColorTool() {
  const { pick } = useLanguage()
  const [foreground, setForeground] = useState("#22d3ee")
  const [background, setBackground] = useState("#080808")
  const [palette, setPalette] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState("")
  const imageUrlRef = useRef("")
  const [error, setError] = useState("")
  const foregroundRgb = useMemo(() => parseHexColor(foreground), [foreground])
  const backgroundRgb = useMemo(() => parseHexColor(background), [background])
  const ratio = foregroundRgb && backgroundRgb ? contrastRatio(foregroundRgb, backgroundRgb) : 0

  useEffect(() => () => { if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current) }, [])

  async function pickFromScreen(target: "foreground" | "background") {
    const EyeDropperApi = (window as typeof window & { EyeDropper?: EyeDropperConstructor }).EyeDropper
    if (!EyeDropperApi) { setError(pick("当前浏览器不支持屏幕取色，请使用颜色输入框。", "This browser does not support screen color picking. Use the color input instead.")); return }
    try {
      const result = await new EyeDropperApi().open()
      if (target === "foreground") setForeground(result.sRGBHex)
      else setBackground(result.sRGBHex)
      setError("")
    } catch { /* User cancelled the browser picker. */ }
  }

  async function loadImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) { setError(pick("请选择图片文件。", "Choose an image file.")); return }
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement("canvas")
      const scale = Math.min(1, 128 / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) throw new Error("Canvas unavailable")
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      setPalette(extractPalette(data, 8))
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
      imageUrlRef.current = URL.createObjectURL(file)
      setImageUrl(imageUrlRef.current)
      setError("")
    } catch { setError(pick("无法读取这张图片，请换用 PNG、JPG 或 WebP。", "Unable to read this image. Try PNG, JPG, or WebP.")) }
  }

  const hsl = foregroundRgb ? rgbToHsl(foregroundRgb) : null
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("颜色格式与无障碍对比度", "Color formats and accessibility contrast")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <ColorInput label={pick("前景色", "Foreground")} value={foreground} onChange={setForeground} onPick={() => pickFromScreen("foreground")} />
        <ColorInput label={pick("背景色", "Background")} value={background} onChange={setBackground} onPick={() => pickFromScreen("background")} />
      </div>
      <div className="rounded-xl border border-white/10 p-6 text-center text-2xl font-bold" style={{ color: foregroundRgb ? foreground : undefined, backgroundColor: backgroundRgb ? background : undefined }}>{pick("文字颜色预览 Aa", "Text contrast preview Aa")}</div>
      {foregroundRgb && hsl ? <div className="grid gap-3 sm:grid-cols-3"><Value label="HEX" value={foreground.toUpperCase()} /><Value label="RGB" value={`rgb(${foregroundRgb.r}, ${foregroundRgb.g}, ${foregroundRgb.b})`} /><Value label="HSL" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} /></div> : null}
      <div className="rounded-lg border border-white/10 p-4"><p className="text-xs text-zinc-500">{pick("WCAG 对比度", "WCAG contrast")}</p><p className="mt-2 text-3xl font-semibold">{ratio ? `${ratio.toFixed(2)}:1` : "—"}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><Status ok={ratio >= 4.5} label={pick("AA 普通文本", "AA normal text")} /><Status ok={ratio >= 3} label={pick("AA 大号文本", "AA large text")} /><Status ok={ratio >= 7} label={pick("AAA 普通文本", "AAA normal text")} /></div></div>
      {error ? <Alert variant="destructive"><Palette /><AlertTitle>{pick("取色不可用", "Color tool unavailable")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>{pick("图片调色板提取", "Image palette extractor")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 px-5 py-9 text-sm text-zinc-400 hover:border-cyan-300/30 hover:text-cyan-200"><ImageIcon className="size-5" />{pick("选择 PNG、JPG、WebP 等图片", "Choose a PNG, JPG, WebP, or other browser-supported image")}<input type="file" accept="image/*" className="sr-only" onChange={(event) => loadImage(event.target.files?.[0])} /></label>
      {imageUrl ? <>
        {/* eslint-disable-next-line @next/next/no-img-element -- Local object URLs cannot use the Next image optimizer. */}
        <img src={imageUrl} alt={pick("调色板来源图片", "Palette source")} className="max-h-72 w-full rounded-lg border border-white/10 object-contain" />
      </> : null}
      {palette.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{palette.map((color) => <button key={color} type="button" onClick={() => navigator.clipboard.writeText(color)} className="overflow-hidden rounded-lg border border-white/10 text-left"><span className="block h-20" style={{ backgroundColor: color }} /><span className="flex items-center justify-between px-3 py-2 font-mono text-xs"><span>{color}</span><Copy className="size-3.5" /></span></button>)}</div> : null}
    </CardContent></Card>
  </div>
}

function ColorInput({ label, value, onChange, onPick }: { label: string; value: string; onChange: (value: string) => void; onPick: () => void }) {
  return <div className="space-y-2"><span className="text-sm">{label}</span><div className="flex gap-2"><input aria-label={`${label} picker`} type="color" value={parseHexColor(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value)} className="size-10 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent" /><Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" /><Button variant="outline" size="icon" onClick={onPick} aria-label={`${label} screen picker`}><Eye /></Button></div></div>
}
function Value({ label, value }: { label: string; value: string }) { return <button type="button" onClick={() => navigator.clipboard.writeText(value)} className="rounded-lg border border-white/10 p-3 text-left"><span className="text-xs text-zinc-500">{label}</span><span className="mt-1 flex items-center justify-between gap-2 font-mono text-xs"><span className="break-all">{value}</span><Copy className="size-3.5 shrink-0" /></span></button> }
function Status({ ok, label }: { ok: boolean; label: string }) { return <span className={`rounded-full border px-2.5 py-1 ${ok ? "border-emerald-400/25 text-emerald-300" : "border-rose-400/25 text-rose-300"}`}>{ok ? "PASS" : "FAIL"} · {label}</span> }

export type RgbColor = { r: number; g: number; b: number }
export function parseHexColor(value: string): RgbColor | null {
  const match = value.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i)
  if (!match) return null
  const hex = match[1].length === 3 ? match[1].split("").map((character) => character + character).join("") : match[1]
  return { r: Number.parseInt(hex.slice(0, 2), 16), g: Number.parseInt(hex.slice(2, 4), 16), b: Number.parseInt(hex.slice(4, 6), 16) }
}
export function rgbToHsl({ r, g, b }: RgbColor) {
  const red = r / 255; const green = g / 255; const blue = b / 255
  const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(lightness * 100) }
  const delta = max - min; const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  return { h: Math.round(hue * 60), s: Math.round(saturation * 100), l: Math.round(lightness * 100) }
}
function luminance({ r, g, b }: RgbColor) { return [r, g, b].map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0) }
export function contrastRatio(left: RgbColor, right: RgbColor) { const lighter = Math.max(luminance(left), luminance(right)); const darker = Math.min(luminance(left), luminance(right)); return (lighter + 0.05) / (darker + 0.05) }
export function extractPalette(data: Uint8ClampedArray, count: number) {
  const buckets = new Map<string, number>()
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue
    const channels = [data[index], data[index + 1], data[index + 2]].map((value) => Math.min(255, Math.round(value / 32) * 32))
    const color = `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`
    buckets.set(color, (buckets.get(color) ?? 0) + 1)
  }
  return [...buckets.entries()].sort((left, right) => right[1] - left[1]).slice(0, count).map(([color]) => color)
}
