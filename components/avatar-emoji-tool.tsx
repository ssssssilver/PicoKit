"use client"

import { Download, ImageIcon, Type } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { canvasToBlob, downloadBlob } from "@/lib/browser-files"

export function AvatarEmojiTool() {
  const { pick } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<"text" | "image">("text")
  const [text, setText] = useState("PK")
  const [textColor, setTextColor] = useState("#08111f")
  const [background, setBackground] = useState("#22d3ee")
  const [shape, setShape] = useState<"square" | "circle" | "rounded">("rounded")
  const [padding, setPadding] = useState(12)
  const [imageUrl, setImageUrl] = useState("")
  const imageUrlRef = useRef("")

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const context = canvas.getContext("2d"); if (!context) return
    const draw = (image?: HTMLImageElement) => drawAvatar(context, { text, textColor, background, shape, padding, image })
    if (mode === "image" && imageUrl) {
      const image = new Image(); image.onload = () => draw(image); image.onerror = () => draw(); image.src = imageUrl
      return
    }
    draw()
  }, [background, imageUrl, mode, padding, shape, text, textColor])

  useEffect(() => () => { if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current) }, [])

  function loadImage(file: File | undefined) {
    if (!file?.type.startsWith("image/")) return
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = URL.createObjectURL(file)
    setImageUrl(imageUrlRef.current); setMode("image")
  }

  async function download(size: 128 | 512) {
    const source = canvasRef.current; if (!source) return
    const output = document.createElement("canvas"); output.width = size; output.height = size
    output.getContext("2d")?.drawImage(source, 0, 0, size, size)
    downloadBlob(await canvasToBlob(output), `tabnative-avatar-${size}.png`)
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
    <Card><CardHeader><CardTitle>{pick("设计头像或团队表情", "Design an avatar or team emoji")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="flex gap-2"><Button variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")}><Type />{pick("文字", "Text")}</Button><Button variant={mode === "image" ? "default" : "outline"} onClick={() => setMode("image")}><ImageIcon />{pick("图片", "Image")}</Button></div>
      {mode === "text" ? <label className="grid gap-2 text-sm"><span>{pick("短文字或缩写", "Short text or initials")}</span><Input value={text} maxLength={8} onChange={(event) => setText(event.target.value)} /></label> : <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-8 text-sm text-zinc-400"><ImageIcon className="size-5" />{pick("选择本地图片", "Choose a local image")}<input type="file" accept="image/*" className="sr-only" onChange={(event) => loadImage(event.target.files?.[0])} /></label>}
      <div className="grid gap-4 sm:grid-cols-2"><ColorField label={pick("背景色", "Background")} value={background} onChange={setBackground} /><ColorField label={pick("文字颜色", "Text color")} value={textColor} onChange={setTextColor} /></div>
      <div><p className="mb-2 text-sm">{pick("形状", "Shape")}</p><div className="flex flex-wrap gap-2">{(["square", "rounded", "circle"] as const).map((item) => <Button key={item} size="sm" variant={shape === item ? "default" : "outline"} onClick={() => setShape(item)}>{{ square: pick("方形", "Square"), rounded: pick("圆角", "Rounded"), circle: pick("圆形", "Circle") }[item]}</Button>)}</div></div>
      <label className="grid gap-2 text-sm"><span>{pick("安全边距", "Safe padding")}: {padding}%</span><input type="range" min="0" max="30" value={padding} onChange={(event) => setPadding(Number(event.target.value))} className="w-full accent-cyan-300" /></label>
      <div className="flex flex-wrap gap-2"><Button onClick={() => download(512)}><Download />512 × 512 PNG</Button><Button variant="outline" onClick={() => download(128)}><Download />128 × 128 PNG</Button></div>
      <p className="text-xs leading-5 text-zinc-500">{pick("适合头像、群组图标和静态团队表情。动画表情请使用现有 GIF 工具。", "Best for avatars, group icons, and static team emoji. Use the GIF toolkit for animation.")}</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{pick("实时预览", "Live preview")}</CardTitle></CardHeader><CardContent><div className="mx-auto aspect-square w-full max-w-sm rounded-xl bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-4"><canvas ref={canvasRef} width="512" height="512" className="size-full object-contain" aria-label={pick("头像预览", "Avatar preview")} /></div></CardContent></Card>
  </div>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm"><span>{label}</span><div className="flex gap-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-10 rounded border border-white/10 bg-transparent" /><Input value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" /></div></label> }

export function drawAvatar(context: CanvasRenderingContext2D, options: { text: string; textColor: string; background: string; shape: "square" | "circle" | "rounded"; padding: number; image?: HTMLImageElement }) {
  const size = context.canvas.width; context.clearRect(0, 0, size, size); context.save()
  context.beginPath()
  if (options.shape === "circle") context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  else if (options.shape === "rounded") context.roundRect(0, 0, size, size, size * 0.18)
  else context.rect(0, 0, size, size)
  context.clip(); context.fillStyle = options.background; context.fillRect(0, 0, size, size)
  const inset = size * options.padding / 100
  if (options.image) {
    const scale = Math.max((size - inset * 2) / options.image.naturalWidth, (size - inset * 2) / options.image.naturalHeight)
    const width = options.image.naturalWidth * scale; const height = options.image.naturalHeight * scale
    context.drawImage(options.image, (size - width) / 2, (size - height) / 2, width, height)
  } else {
    const content = options.text.trim().slice(0, 8) || "PK"; context.fillStyle = options.textColor; context.textAlign = "center"; context.textBaseline = "middle"; context.font = `700 ${Math.max(48, Math.round(size * Math.min(0.56, 1.5 / content.length)))}px ui-sans-serif, system-ui, sans-serif`; context.fillText(content, size / 2, size / 2, size - inset * 2)
  }
  context.restore()
}
