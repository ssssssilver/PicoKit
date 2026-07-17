"use client"

import { AudioLines, Download, LoaderCircle, Volume2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { baseName, downloadBlob, formatBytes, safeError } from "@/lib/browser-files"

export function AudioTool() {
  const { pick } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState("")
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [start, setStart] = useState(0), [end, setEnd] = useState(0)
  const [volume, setVolume] = useState(100), [fadeIn, setFadeIn] = useState(.3), [fadeOut, setFadeOut] = useState(.3)
  const [mono, setMono] = useState(false), [running, setRunning] = useState(false), [error, setError] = useState("")

  useEffect(() => { if (buffer && canvasRef.current) drawWaveform(canvasRef.current, buffer) }, [buffer])
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl) }, [sourceUrl])

  async function open(next: File | undefined) {
    if (!next) return
    setRunning(true); setError("")
    try {
      if (next.size > 150 * 1024 * 1024) throw new Error(pick("音频文件不能超过 150 MB", "Audio files must be 150 MB or smaller"))
      const context = new AudioContext(), decoded = await context.decodeAudioData(await next.arrayBuffer()); await context.close()
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
      setFile(next); setSourceUrl(URL.createObjectURL(next)); setBuffer(decoded); setStart(0); setEnd(Number(decoded.duration.toFixed(2)))
    } catch (reason) { setError(safeError(reason, pick("浏览器无法解码该音频", "The browser cannot decode this audio file"))) }
    finally { setRunning(false) }
  }

  function exportWav() {
    if (!file || !buffer) return
    try {
      const from = Math.max(0, Math.floor(start * buffer.sampleRate)), to = Math.min(buffer.length, Math.floor(end * buffer.sampleRate))
      if (to <= from) throw new Error(pick("结束时间必须晚于开始时间", "End time must be after start time"))
      const count = mono ? 1 : buffer.numberOfChannels, length = to - from
      const channels = Array.from({ length: count }, () => new Float32Array(length))
      for (let index = 0; index < length; index++) {
        const elapsed = index / buffer.sampleRate, remaining = (length - index) / buffer.sampleRate
        const gain = Math.min(1, fadeIn ? elapsed / fadeIn : 1, fadeOut ? remaining / fadeOut : 1) * volume / 100
        if (mono) { let sample = 0; for (let channel = 0; channel < buffer.numberOfChannels; channel++) sample += buffer.getChannelData(channel)[from + index] / buffer.numberOfChannels; channels[0][index] = sample * gain }
        else for (let channel = 0; channel < count; channel++) channels[channel][index] = buffer.getChannelData(channel)[from + index] * gain
      }
      downloadBlob(encodeWav(channels, buffer.sampleRate), `${baseName(file.name)}-tabnative.wav`)
    } catch (reason) { setError(safeError(reason, pick("音频导出失败", "Audio export failed"))) }
  }

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("音频裁剪与 WAV 导出", "Trim audio and export WAV")}</CardTitle></CardHeader><CardContent className="space-y-5">
    <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 text-sm hover:border-cyan-300/40"><AudioLines className="text-cyan-300" />{running ? <LoaderCircle className="animate-spin" /> : file ? `${file.name} · ${formatBytes(file.size)}` : pick("选择浏览器支持的音频文件", "Choose an audio file supported by your browser")}<input className="sr-only" type="file" accept="audio/*" onChange={(event) => void open(event.target.files?.[0])} /></label>
    {buffer ? <><canvas ref={canvasRef} width="1000" height="180" className="h-40 w-full rounded-lg border border-white/10 bg-[#090909]" /><audio controls src={sourceUrl} className="w-full" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label={pick("开始（秒）", "Start (seconds)")}><Input type="number" min="0" max={buffer.duration} step=".01" value={start} onChange={(e) => setStart(Number(e.target.value))} /></Field><Field label={pick("结束（秒）", "End (seconds)")}><Input type="number" min="0" max={buffer.duration} step=".01" value={end} onChange={(e) => setEnd(Number(e.target.value))} /></Field><Field label={`${pick("音量", "Volume")} ${volume}%`}><Input type="range" min="0" max="200" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></Field><Field label={pick("淡入（秒）", "Fade in (seconds)")}><Input type="number" min="0" max="10" step=".1" value={fadeIn} onChange={(e) => setFadeIn(Number(e.target.value))} /></Field><Field label={pick("淡出（秒）", "Fade out (seconds)")}><Input type="number" min="0" max="10" step=".1" value={fadeOut} onChange={(e) => setFadeOut(Number(e.target.value))} /></Field><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={mono} onChange={(e) => setMono(e.target.checked)} />{pick("转换为单声道", "Convert to mono")}</label></div><Button size="lg" onClick={exportWav}><Download />{pick("导出裁剪后的 WAV", "Export trimmed WAV")}</Button></> : null}
    {error ? <Alert variant="destructive"><Volume2 /><AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </CardContent></Card></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm"><span>{label}</span>{children}</label> }
function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer) { const context = canvas.getContext("2d"); if (!context) return; context.clearRect(0, 0, canvas.width, canvas.height); context.strokeStyle = "#67e8f9"; context.beginPath(); const data = buffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / canvas.width)); for (let x = 0; x < canvas.width; x++) { let min = 1, max = -1; for (let i = 0; i < step; i++) { const value = data[x * step + i] ?? 0; min = Math.min(min, value); max = Math.max(max, value) } context.moveTo(x, (1 + min) * canvas.height / 2); context.lineTo(x, (1 + max) * canvas.height / 2) } context.stroke() }
export function encodeWav(channels: Float32Array[], sampleRate: number) { const count = channels.length, length = channels[0].length, buffer = new ArrayBuffer(44 + length * count * 2), view = new DataView(buffer); write(view, 0, "RIFF"); view.setUint32(4, 36 + length * count * 2, true); write(view, 8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); write(view, 36, "data"); view.setUint32(40, length * count * 2, true); let offset = 44; for (let i = 0; i < length; i++) for (let c = 0; c < count; c++) { const sample = Math.max(-1, Math.min(1, channels[c][i])); view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2 } return new Blob([buffer], { type: "audio/wav" }) }
function write(view: DataView, offset: number, text: string) { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }
