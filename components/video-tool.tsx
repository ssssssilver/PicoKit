"use client"

import { Clapperboard, ImageDown, LoaderCircle, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { baseName, canvasToBlob, downloadBlob, formatBytes, safeError } from "@/lib/browser-files"

export function VideoTool() {
  const { pick } = useLanguage(), videoRef = useRef<HTMLVideoElement>(null)
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState(""), [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0), [end, setEnd] = useState(0), [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
  const [running, setRunning] = useState(false), [error, setError] = useState("")
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  function open(next: File | undefined) { if (!next) return; if (url) URL.revokeObjectURL(url); setFile(next); setUrl(URL.createObjectURL(next)); setError("") }
  function loaded() { const video = videoRef.current; if (video) { setDuration(video.duration); setEnd(Number(video.duration.toFixed(2))) } }

  async function frame() { const video = videoRef.current; if (!video || !file) return; try { downloadBlob(await canvasToBlob(drawVideo(video, rotation)), `${baseName(file.name)}-frame-${video.currentTime.toFixed(1)}.png`) } catch (reason) { setError(safeError(reason, pick("无法导出画面", "Unable to export frame"))) } }

  async function exportMuted() {
    const video = videoRef.current; if (!video || !file) return
    setRunning(true); setError("")
    try {
      if (typeof MediaRecorder === "undefined") throw new Error(pick("当前浏览器不支持视频录制", "This browser does not support video recording"))
      if (end <= start || end - start > 60) throw new Error(pick("请选择 60 秒以内的有效片段", "Choose a valid clip up to 60 seconds"))
      const rotated = rotation === 90 || rotation === 270, canvas = document.createElement("canvas"); canvas.width = rotated ? video.videoHeight : video.videoWidth; canvas.height = rotated ? video.videoWidth : video.videoHeight
      const context = canvas.getContext("2d")!, stream = canvas.captureStream(30), mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }), chunks: Blob[] = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      const done = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime })) })
      video.currentTime = start; await once(video, "seeked"); recorder.start(250); await video.play()
      await new Promise<void>((resolve) => { const paint = () => { paintVideo(context, video, rotation, canvas.width, canvas.height); if (video.currentTime >= end || video.ended) resolve(); else requestAnimationFrame(paint) }; paint() })
      video.pause(); recorder.stop(); downloadBlob(await done, `${baseName(file.name)}-muted.webm`)
    } catch (reason) { setError(safeError(reason, pick("视频处理失败", "Video processing failed"))) }
    finally { setRunning(false) }
  }

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("视频取帧与静音片段", "Video frame and muted clip")}</CardTitle></CardHeader><CardContent className="space-y-5">
    <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 text-sm hover:border-cyan-300/40"><Clapperboard className="text-cyan-300" />{file ? `${file.name} · ${formatBytes(file.size)}` : pick("选择浏览器支持的视频", "Choose a video supported by your browser")}<input className="sr-only" type="file" accept="video/*" onChange={(e) => open(e.target.files?.[0])} /></label>
    {url ? <><video ref={videoRef} src={url} controls onLoadedMetadata={loaded} className="max-h-[520px] w-full rounded-lg bg-black" /><div className="grid gap-4 sm:grid-cols-3"><Field label={pick("片段开始（秒）", "Clip start (seconds)")}><Input type="number" min="0" max={duration} step=".1" value={start} onChange={(e) => setStart(Number(e.target.value))} /></Field><Field label={pick("片段结束（秒）", "Clip end (seconds)")}><Input type="number" min="0" max={duration} step=".1" value={end} onChange={(e) => setEnd(Number(e.target.value))} /></Field><label className="space-y-2 text-sm"><span>{pick("旋转输出", "Output rotation")}</span><select value={rotation} onChange={(e) => setRotation(Number(e.target.value) as typeof rotation)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></div><div className="flex flex-wrap gap-2"><Button onClick={frame}><ImageDown />{pick("导出当前帧 PNG", "Export current frame PNG")}</Button><Button variant="outline" onClick={exportMuted} disabled={running}>{running ? <LoaderCircle className="animate-spin" /> : <VolumeX />}{running ? pick("正在实时生成", "Generating in real time") : pick("导出静音片段 WebM", "Export muted WebM clip")}</Button></div><p className="text-xs text-zinc-500">{pick("静音片段按实际播放速度生成，最长 60 秒。", "Muted clips are generated in real time, up to 60 seconds.")}</p></> : null}
    {error ? <Alert variant="destructive"><Clapperboard /><AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </CardContent></Card></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span>{label}</span>{children}</label> }
function drawVideo(video: HTMLVideoElement, rotation: number) { const rotated = rotation === 90 || rotation === 270, canvas = document.createElement("canvas"); canvas.width = rotated ? video.videoHeight : video.videoWidth; canvas.height = rotated ? video.videoWidth : video.videoHeight; paintVideo(canvas.getContext("2d")!, video, rotation, canvas.width, canvas.height); return canvas }
function paintVideo(context: CanvasRenderingContext2D, video: HTMLVideoElement, rotation: number, width: number, height: number) { context.save(); context.clearRect(0, 0, width, height); context.translate(width / 2, height / 2); context.rotate(rotation * Math.PI / 180); context.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2); context.restore() }
function once(target: EventTarget, event: string) { return new Promise<void>((resolve) => target.addEventListener(event, () => resolve(), { once: true })) }
