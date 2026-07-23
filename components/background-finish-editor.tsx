"use client"

import { ImageIcon, Layers3, LoaderCircle, Palette, RotateCcw, SlidersHorizontal, Sparkles, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DEFAULT_BACKGROUND_FINISH_SETTINGS,
  backgroundFinishCanvasSize,
  composeBackgroundFinish,
  drawBackgroundFinish,
  normalizeBackgroundFinishSettings,
  type BackgroundCanvasPreset,
  type BackgroundFillMode,
  type BackgroundFinishOutput,
  type BackgroundFinishSettings,
  type BackgroundOutputType,
} from "@/lib/background-finish"

const PREVIEW_MAX_WIDTH = 780
const PREVIEW_MAX_HEIGHT = 620
const BACKGROUND_IMAGE_MAX_BYTES = 15 * 1024 * 1024

export function BackgroundFinishEditor({
  source,
  cutout,
  initialSettings,
  batchCount,
  onApply,
  onApplyBatch,
}: {
  source: File
  cutout: Blob
  initialSettings?: BackgroundFinishSettings
  batchCount: number
  onApply: (output: BackgroundFinishOutput) => void | Promise<void>
  onApplyBatch?: (settings: BackgroundFinishSettings) => void | Promise<void>
}) {
  const { pick } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const sourceBitmapRef = useRef<ImageBitmap | null>(null)
  const cutoutBitmapRef = useRef<ImageBitmap | null>(null)
  const backgroundBitmapRef = useRef<ImageBitmap | null>(null)
  const [settings, setSettings] = useState(() => normalizeBackgroundFinishSettings(initialSettings))
  const [ready, setReady] = useState(false)
  const [cutoutSize, setCutoutSize] = useState({ width: 0, height: 0 })
  const [backgroundReadyVersion, setBackgroundReadyVersion] = useState(0)
  const [applying, setApplying] = useState<"current" | "batch" | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    void Promise.all([createImageBitmap(source), createImageBitmap(cutout)]).then(([sourceBitmap, cutoutBitmap]) => {
      if (cancelled) {
        sourceBitmap.close()
        cutoutBitmap.close()
        return
      }
      sourceBitmapRef.current?.close()
      cutoutBitmapRef.current?.close()
      sourceBitmapRef.current = sourceBitmap
      cutoutBitmapRef.current = cutoutBitmap
      setCutoutSize({ width: cutoutBitmap.width, height: cutoutBitmap.height })
      setReady(true)
    }).catch(() => {
      if (!cancelled) setError(pick("无法准备成品编辑预览，透明结果仍可正常下载。", "The finished-image preview could not be prepared. The transparent result is still available."))
    })
    return () => {
      cancelled = true
      sourceBitmapRef.current?.close()
      cutoutBitmapRef.current?.close()
      sourceBitmapRef.current = null
      cutoutBitmapRef.current = null
    }
  }, [cutout, pick, source])

  useEffect(() => {
    let cancelled = false
    backgroundBitmapRef.current?.close()
    backgroundBitmapRef.current = null
    const backgroundImage = settings.backgroundImage
    if (!backgroundImage) {
      queueMicrotask(() => { if (!cancelled) setBackgroundReadyVersion((value) => value + 1) })
      return () => { cancelled = true }
    }
    void createImageBitmap(backgroundImage).then((bitmap) => {
      if (cancelled) {
        bitmap.close()
        return
      }
      backgroundBitmapRef.current = bitmap
      setBackgroundReadyVersion((value) => value + 1)
    }).catch(() => {
      if (!cancelled) setError(pick("无法读取自定义背景图片，请换一张较小的 JPG、PNG 或 WebP。", "The custom background could not be read. Try a smaller JPG, PNG, or WebP image."))
    })
    return () => {
      cancelled = true
      backgroundBitmapRef.current?.close()
      backgroundBitmapRef.current = null
    }
  }, [pick, settings.backgroundImage])

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    const sourceBitmap = sourceBitmapRef.current
    const cutoutBitmap = cutoutBitmapRef.current
    if (!canvas || !sourceBitmap || !cutoutBitmap || !ready) return
    const output = backgroundFinishCanvasSize(cutoutBitmap.width, cutoutBitmap.height, settings)
    const scale = Math.min(1, PREVIEW_MAX_WIDTH / output.width, PREVIEW_MAX_HEIGHT / output.height)
    canvas.width = Math.max(1, Math.round(output.width * scale))
    canvas.height = Math.max(1, Math.round(output.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return
    drawBackgroundFinish(
      context,
      canvas.width,
      canvas.height,
      sourceBitmap,
      cutoutBitmap,
      settings,
      backgroundBitmapRef.current ?? undefined,
    )
  }, [ready, settings])

  useEffect(() => {
    renderPreview()
  }, [backgroundReadyVersion, renderPreview])

  function updateSettings(update: Partial<BackgroundFinishSettings>) {
    setSettings((current) => normalizeBackgroundFinishSettings({ ...current, ...update }))
    setError("")
  }

  function selectFillMode(fillMode: BackgroundFillMode) {
    updateSettings({
      fillMode,
      outputType: fillMode === "transparent" && settings.outputType === "image/jpeg" ? "image/png" : settings.outputType,
    })
  }

  async function chooseBackground(file?: File) {
    if (!file) return
    if (!file.type.startsWith("image/") || file.size > BACKGROUND_IMAGE_MAX_BYTES) {
      setError(pick("背景图片需要是 15 MB 以内的 JPG、PNG 或 WebP。", "The background must be a JPG, PNG, or WebP image up to 15 MB."))
      return
    }
    updateSettings({ fillMode: "image", backgroundImage: file })
  }

  async function applyCurrent() {
    if (!ready || applying) return
    setApplying("current")
    setError("")
    try {
      await onApply(await composeBackgroundFinish(source, cutout, settings))
    } catch {
      setError(pick("未能生成成品图片，请减小画布尺寸或移除自定义背景后重试。", "The finished image could not be generated. Reduce the canvas size or remove the custom background and try again."))
    } finally {
      setApplying(null)
    }
  }

  async function applyBatch() {
    if (!ready || applying || !onApplyBatch || batchCount < 2) return
    setApplying("batch")
    setError("")
    try {
      await onApplyBatch(settings)
    } catch {
      setError(pick("未能把这套设置应用到全部图片，请减小画布尺寸后重试。", "These settings could not be applied to every image. Reduce the canvas size and try again."))
    } finally {
      setApplying(null)
    }
  }

  const sourceSize = cutoutSize.width && cutoutSize.height
    ? backgroundFinishCanvasSize(cutoutSize.width, cutoutSize.height, settings)
    : { width: 0, height: 0 }

  return <Card className="border-cyan-300/20 bg-cyan-300/[.025] shadow-none">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base text-zinc-100"><Sparkles className="size-4 text-cyan-300" />{pick("成品编辑", "Finish image")}</CardTitle>
      <p className="text-sm leading-6 text-zinc-500">{pick(
        "在透明主体后添加颜色、渐变、自定义图片或模糊原图，再调整画布、主体位置和阴影。透明蒙版会单独保留，之后仍可继续修边。",
        "Add a color, gradient, custom image, or blurred original behind the cutout, then adjust the canvas, subject position, and shadow. The transparent mask stays separate so you can refine it later.",
      )}</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="grid min-h-80 place-items-center overflow-auto rounded-xl border border-white/10 bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-3">
          {ready ? <canvas ref={canvasRef} className="block max-h-[620px] max-w-full shadow-2xl" aria-label={pick("成品图片预览", "Finished-image preview")} /> : <LoaderCircle className="size-8 animate-spin text-cyan-300" />}
        </div>

        <Tabs defaultValue="background" className="flex-col rounded-xl border border-white/10 bg-white/[.025] p-3">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="background" className="min-h-9"><Palette />{pick("背景", "Background")}</TabsTrigger>
            <TabsTrigger value="layout" className="min-h-9"><Layers3 />{pick("画布", "Canvas")}</TabsTrigger>
            <TabsTrigger value="effects" className="min-h-9"><SlidersHorizontal />{pick("效果", "Effects")}</TabsTrigger>
          </TabsList>

          <TabsContent value="background" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <ModeButton active={settings.fillMode === "transparent"} onClick={() => selectFillMode("transparent")} label={pick("透明", "Transparent")} swatch="checker" />
              <ModeButton active={settings.fillMode === "color"} onClick={() => selectFillMode("color")} label={pick("纯色", "Solid color")} swatch={settings.color} />
              <ModeButton active={settings.fillMode === "gradient"} onClick={() => selectFillMode("gradient")} label={pick("渐变", "Gradient")} swatch={`linear-gradient(135deg,${settings.gradientStart},${settings.gradientEnd})`} />
              <ModeButton active={settings.fillMode === "blur-original"} onClick={() => selectFillMode("blur-original")} label={pick("模糊原图", "Blur original")} swatch="blur" />
            </div>
            <input ref={backgroundInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => { void chooseBackground(event.target.files?.[0]); event.currentTarget.value = "" }} />
            <Button type="button" variant={settings.fillMode === "image" ? "default" : "outline"} className="w-full" onClick={() => backgroundInputRef.current?.click()}><Upload />{settings.backgroundImage ? settings.backgroundImage.name : pick("上传自定义背景", "Upload custom background")}</Button>
            {settings.fillMode === "color" ? <ColorControl label={pick("背景颜色", "Background color")} value={settings.color} onChange={(color) => updateSettings({ color })} /> : null}
            {settings.fillMode === "gradient" ? <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ColorControl label={pick("起始颜色", "Start color")} value={settings.gradientStart} onChange={(gradientStart) => updateSettings({ gradientStart })} />
                <ColorControl label={pick("结束颜色", "End color")} value={settings.gradientEnd} onChange={(gradientEnd) => updateSettings({ gradientEnd })} />
              </div>
              <RangeControl label={pick("渐变角度", "Gradient angle")} value={settings.gradientAngle} min={0} max={360} unit="°" onChange={(gradientAngle) => updateSettings({ gradientAngle })} />
            </div> : null}
            {settings.fillMode === "image" && !settings.backgroundImage ? <p className="text-xs leading-5 text-amber-300">{pick("请选择一张本地图片作为背景。", "Choose a local image to use as the background.")}</p> : null}
          </TabsContent>

          <TabsContent value="layout" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-2">
              {([
                ["original", pick("原始尺寸", "Original")],
                ["square", "1:1 · 1080"],
                ["portrait", "4:5 · 1080×1350"],
                ["story", "9:16 · 1080×1920"],
                ["marketplace", pick("电商方图 · 2000", "Marketplace · 2000")],
                ["custom", pick("自定义", "Custom")],
              ] as Array<[BackgroundCanvasPreset, string]>).map(([value, label]) => <Button key={value} type="button" size="sm" variant={settings.canvasPreset === value ? "default" : "outline"} onClick={() => updateSettings({ canvasPreset: value })}>{label}</Button>)}
            </div>
            {settings.canvasPreset === "custom" ? <div className="grid grid-cols-2 gap-3">
              <NumberControl label={pick("宽度", "Width")} value={settings.customWidth} onChange={(customWidth) => updateSettings({ customWidth })} />
              <NumberControl label={pick("高度", "Height")} value={settings.customHeight} onChange={(customHeight) => updateSettings({ customHeight })} />
            </div> : null}
            <RangeControl label={pick("主体大小", "Subject size")} value={settings.subjectScale} min={40} max={140} unit="%" onChange={(subjectScale) => updateSettings({ subjectScale })} />
            <RangeControl label={pick("水平位置", "Horizontal position")} value={settings.subjectX} min={-50} max={50} unit="" onChange={(subjectX) => updateSettings({ subjectX })} />
            <RangeControl label={pick("垂直位置", "Vertical position")} value={settings.subjectY} min={-50} max={50} unit="" onChange={(subjectY) => updateSettings({ subjectY })} />
          </TabsContent>

          <TabsContent value="effects" className="space-y-4 pt-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300">
              <span>{pick("添加主体阴影", "Add subject shadow")}</span>
              <input type="checkbox" checked={settings.shadowEnabled} onChange={(event) => updateSettings({ shadowEnabled: event.target.checked })} className="size-4 accent-cyan-400" />
            </label>
            {settings.shadowEnabled ? <>
              <ColorControl label={pick("阴影颜色", "Shadow color")} value={settings.shadowColor} onChange={(shadowColor) => updateSettings({ shadowColor })} />
              <RangeControl label={pick("阴影不透明度", "Shadow opacity")} value={settings.shadowOpacity} min={0} max={100} unit="%" onChange={(shadowOpacity) => updateSettings({ shadowOpacity })} />
              <RangeControl label={pick("阴影模糊", "Shadow blur")} value={settings.shadowBlur} min={0} max={80} unit="" onChange={(shadowBlur) => updateSettings({ shadowBlur })} />
              <RangeControl label={pick("阴影水平偏移", "Shadow horizontal offset")} value={settings.shadowOffsetX} min={-80} max={80} unit="" onChange={(shadowOffsetX) => updateSettings({ shadowOffsetX })} />
              <RangeControl label={pick("阴影垂直偏移", "Shadow vertical offset")} value={settings.shadowOffsetY} min={-80} max={80} unit="" onChange={(shadowOffsetY) => updateSettings({ shadowOffsetY })} />
            </> : <p className="text-xs leading-5 text-zinc-500">{pick("阴影适合商品图、头像和贴纸式素材，透明 PNG 也会保留阴影。", "Shadows work well for product images, profile photos, and sticker-like assets, including transparent PNG exports.")}</p>}
          </TabsContent>
        </Tabs>
      </div>

      <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[.025] p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["image/png", "PNG"],
              ["image/webp", "WebP"],
              ["image/jpeg", "JPEG"],
            ] as Array<[BackgroundOutputType, string]>).map(([value, label]) => <Button key={value} type="button" size="sm" variant={settings.outputType === value ? "default" : "outline"} onClick={() => updateSettings({
              outputType: value,
              fillMode: value === "image/jpeg" && settings.fillMode === "transparent" ? "color" : settings.fillMode,
              color: value === "image/jpeg" && settings.fillMode === "transparent" ? "#ffffff" : settings.color,
            })}>{label}</Button>)}
          </div>
          {settings.outputType !== "image/png" ? <RangeControl label={pick("导出质量", "Export quality")} value={settings.quality} min={40} max={100} unit="%" onChange={(quality) => updateSettings({ quality })} /> : null}
          <p className="text-xs text-zinc-500">{sourceSize.width} × {sourceSize.height} px · {pick("全部在当前设备合成", "Composited entirely on this device")}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button type="button" variant="outline" disabled={Boolean(applying)} onClick={() => setSettings(normalizeBackgroundFinishSettings(DEFAULT_BACKGROUND_FINISH_SETTINGS))}><RotateCcw />{pick("重置设置", "Reset settings")}</Button>
          {batchCount > 1 && onApplyBatch ? <Button type="button" variant="outline" disabled={!ready || Boolean(applying)} onClick={() => void applyBatch()}>{applying === "batch" ? <LoaderCircle className="animate-spin" /> : <ImageIcon />}{pick("应用到全部完成项", "Apply to all completed")}</Button> : null}
          <Button type="button" disabled={!ready || Boolean(applying) || (settings.fillMode === "image" && !settings.backgroundImage)} onClick={() => void applyCurrent()}>{applying === "current" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{pick("应用到当前图片", "Apply to current image")}</Button>
        </div>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    </CardContent>
  </Card>
}

function ModeButton({ active, onClick, label, swatch }: { active: boolean; onClick: () => void; label: string; swatch: string }) {
  const swatchStyle = swatch.startsWith("#") || swatch.startsWith("linear-gradient") ? { background: swatch } : undefined
  return <button type="button" onClick={onClick} className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${active ? "border-cyan-300 bg-cyan-300/[.08] text-cyan-100" : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"}`}>
    <span className={`size-6 shrink-0 rounded-md border border-white/15 ${swatch === "checker" ? "bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:8px_8px]" : swatch === "blur" ? "bg-gradient-to-br from-cyan-200/70 via-violet-300/60 to-zinc-800 blur-[1px]" : ""}`} style={swatchStyle} />
    <span>{label}</span>
  </button>
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-xs text-zinc-400">
    <span>{label}</span>
    <span className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-7 cursor-pointer border-0 bg-transparent p-0" />
      <span className="font-mono text-zinc-300">{value.toUpperCase()}</span>
    </span>
  </label>
}

function RangeControl({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-xs text-zinc-400">
    <span className="flex items-center justify-between gap-3"><span>{label}</span><span className="font-mono text-zinc-300">{Math.round(value)}{unit}</span></span>
    <input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-cyan-400" />
  </label>
}

function NumberControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-xs text-zinc-400">
    <span>{label}</span>
    <input type="number" min="64" max="4096" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 rounded-md border border-white/10 bg-black/20 px-3 font-mono text-sm text-zinc-200 outline-none focus:border-cyan-300/60" />
  </label>
}
