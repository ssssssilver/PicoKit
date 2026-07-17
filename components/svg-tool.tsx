"use client"

import { Download, FileCode2, ImageDown, Minimize2, WandSparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { canvasToBlob, downloadBlob, downloadText } from "@/lib/browser-files"

const initialSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <rect width="640" height="360" rx="40" fill="#0f172a"/>
  <circle cx="150" cy="180" r="88" fill="#22d3ee"/>
  <text x="280" y="200" fill="white" font-size="64" font-family="sans-serif" font-weight="700">TabNative</text>
</svg>`

export function SvgTool() {
  const { pick } = useLanguage()
  const [source, setSource] = useState(initialSvg)
  const [safeSvg, setSafeSvg] = useState("")
  const [error, setError] = useState("")
  const [pngWidth, setPngWidth] = useState(1280)
  const dimensions = useMemo(() => inspectSvgDimensions(safeSvg), [safeSvg])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const parser = new DOMParser(); const documentNode = parser.parseFromString(source, "image/svg+xml")
        if (documentNode.querySelector("parsererror") || documentNode.documentElement.tagName.toLowerCase() !== "svg") throw new Error("Invalid SVG")
        const { default: DOMPurify } = await import("dompurify")
        const sanitized = DOMPurify.sanitize(source, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["script", "foreignObject"], FORBID_ATTR: ["href", "xlink:href"] })
        if (!active) return
        setSafeSvg(sanitized); setError("")
      } catch { if (active) { setSafeSvg(""); setError(pick("SVG 结构无效，请检查标签是否完整。", "The SVG structure is invalid. Check for incomplete tags.")) } }
    }, 120)
    return () => { active = false; window.clearTimeout(timer) }
  }, [pick, source])

  async function loadFile(file: File | undefined) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError(pick("SVG 文件请控制在 2 MB 以内。", "Keep the SVG file under 2 MB.")); return }
    setSource(await file.text())
  }

  async function exportPng() {
    if (!safeSvg || !dimensions) return
    const width = Math.max(16, Math.min(4096, pngWidth)); const height = Math.max(1, Math.round(width / dimensions.ratio))
    const url = URL.createObjectURL(new Blob([safeSvg], { type: "image/svg+xml" }))
    try {
      const image = new Image(); image.decoding = "async"
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("SVG render failed")); image.src = url })
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height
      const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas unavailable")
      context.drawImage(image, 0, 0, width, height)
      downloadBlob(await canvasToBlob(canvas), `tabnative-svg-${width}x${height}.png`)
    } catch { setError(pick("无法导出 PNG，请检查 SVG 是否引用了外部资源。", "Unable to export PNG. Check whether the SVG references external resources.")) }
    finally { URL.revokeObjectURL(url) }
  }

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("SVG 编辑、安全预览与导出", "Edit, safely preview, and export SVG")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-5 text-sm text-zinc-400 hover:border-cyan-300/30"><FileCode2 className="size-5" />{pick("打开本地 SVG", "Open a local SVG")}<input type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={(event) => loadFile(event.target.files?.[0])} /></label>
    <div className="grid overflow-hidden rounded-xl border border-white/10 lg:grid-cols-2"><div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r"><Textarea aria-label={pick("SVG 源码", "SVG source")} value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} className="min-h-[460px] resize-y border-0 bg-transparent p-0 font-mono text-xs focus-visible:ring-0" /></div><div className="grid min-h-[460px] place-items-center bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-6"><div className="flex w-full items-center justify-center overflow-hidden [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[400px] [&_svg]:w-full [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: safeSvg }} /></div></div>
    {error ? <Alert variant="destructive"><FileCode2 /><AlertTitle>{pick("SVG 无法处理", "Unable to process SVG")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    {dimensions ? <p className="text-xs text-zinc-500">viewBox: {dimensions.width} × {dimensions.height} · {pick("比例", "ratio")} {dimensions.ratio.toFixed(3)} · {pick("预览已移除脚本、外部链接和 foreignObject", "scripts, external links, and foreignObject are removed from the preview")}</p> : null}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setSource(formatSvg(source))}><WandSparkles />{pick("格式化", "Format")}</Button><Button variant="outline" onClick={() => setSource(minifySvg(source))}><Minimize2 />{pick("压缩源码", "Minify")}</Button><Button disabled={!safeSvg} onClick={() => downloadText(safeSvg, "tabnative.svg", "image/svg+xml")}><Download />{pick("下载安全 SVG", "Download safe SVG")}</Button></div>
    <div className="grid items-end gap-3 sm:grid-cols-[220px_auto]"><label className="grid gap-2 text-sm"><span>{pick("PNG 输出宽度（16–4096）", "PNG width (16–4096)")}</span><Input type="number" min="16" max="4096" value={pngWidth} onChange={(event) => setPngWidth(Number(event.target.value))} /></label><Button variant="outline" disabled={!safeSvg} onClick={exportPng}><ImageDown />{pick("导出 PNG", "Export PNG")}</Button></div>
  </CardContent></Card></div>
}

export function minifySvg(source: string) { return source.replace(/<!--([\s\S]*?)-->/g, "").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim() }
export function formatSvg(source: string) {
  const compact = source.replace(/>\s*</g, "><").trim(); let indent = 0
  return compact.replace(/(<[^>]+>)/g, "$1\n").split("\n").filter(Boolean).map((line) => {
    const closing = /^<\//.test(line); const selfClosing = /<\/|\/>$/.test(line); if (closing) indent = Math.max(0, indent - 1)
    const output = `${"  ".repeat(indent)}${line}`; if (!closing && !selfClosing && /^<[^!?][^>]*>$/.test(line)) indent++
    return output
  }).join("\n")
}
export function inspectSvgDimensions(svg: string) {
  const viewBox = svg.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i)
  const width = Number(viewBox?.[1] ?? svg.match(/\bwidth=["']([\d.]+)/i)?.[1]); const height = Number(viewBox?.[2] ?? svg.match(/\bheight=["']([\d.]+)/i)?.[1])
  return width > 0 && height > 0 ? { width, height, ratio: width / height } : null
}
