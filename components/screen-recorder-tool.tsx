"use client"

import { Download, Mic, MonitorUp, Square, Video } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { downloadBlob, formatBytes } from "@/lib/browser-files"

export function ScreenRecorderTool() {
  const { pick } = useLanguage()
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true)
  const [includeMicrophone, setIncludeMicrophone] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; url: string; extension: string } | null>(null)
  const [error, setError] = useState("")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamsRef = useRef<MediaStream[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const startedAtRef = useRef(0)
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia) && typeof MediaRecorder !== "undefined"

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [recording])
  useEffect(() => () => { streamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop())); if (recorderRef.current?.state === "recording") recorderRef.current.stop() }, [])
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result])

  async function startRecording() {
    setError(""); setElapsed(0)
    if (!supported) { setError(pick("当前浏览器不支持屏幕录制，请使用最新版 Chrome、Edge、Firefox 或 Safari。", "This browser does not support screen recording. Use a current Chrome, Edge, Firefox, or Safari.")); return }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: includeSystemAudio })
      const streams = [display]; let microphone: MediaStream | null = null
      if (includeMicrophone) { microphone = await navigator.mediaDevices.getUserMedia({ audio: true }); streams.push(microphone) }
      streamsRef.current = streams
      const output = new MediaStream(display.getVideoTracks())
      const audioTracks = [...display.getAudioTracks(), ...(microphone?.getAudioTracks() ?? [])]
      if (audioTracks.length === 1) output.addTrack(audioTracks[0])
      else if (audioTracks.length > 1) {
        const context = new AudioContext(); const destination = context.createMediaStreamDestination(); audioContextRef.current = context
        for (const track of audioTracks) context.createMediaStreamSource(new MediaStream([track])).connect(destination)
        destination.stream.getAudioTracks().forEach((track) => output.addTrack(track))
      }
      const mimeType = chooseRecordingMimeType(); const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(output, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : { videoBitsPerSecond: 5_000_000 })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "video/webm"; const blob = new Blob(chunks, { type }); const url = URL.createObjectURL(blob)
        setResult((current) => { if (current?.url) URL.revokeObjectURL(current.url); return { blob, url, extension: type.includes("mp4") ? "mp4" : "webm" } })
        setRecording(false); streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop())); void audioContextRef.current?.close(); audioContextRef.current = null
      }
      display.getVideoTracks()[0]?.addEventListener("ended", () => { if (recorder.state === "recording") recorder.stop() }, { once: true })
      recorder.start(1000); startedAtRef.current = Date.now(); setRecording(true)
    } catch (reason) {
      streamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
      const name = reason instanceof DOMException ? reason.name : ""
      setError(name === "NotAllowedError" ? pick("录制授权已取消或被浏览器阻止。请重新点击并选择要共享的屏幕、窗口或标签页。", "Recording permission was cancelled or blocked. Try again and choose a screen, window, or tab to share.") : name === "NotFoundError" ? pick("没有找到可共享的屏幕或麦克风设备。", "No shareable screen or microphone device was found.") : pick("无法开始录制，请关闭其他占用屏幕或麦克风的应用后重试。", "Unable to start recording. Close other apps using the screen or microphone and try again."))
    }
  }

  function stopRecording() { if (recorderRef.current?.state === "recording") recorderRef.current.stop() }

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("浏览器本地屏幕录制", "Local browser screen recorder")}</CardTitle></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-lg border border-white/10 p-4 text-sm"><Checkbox checked={includeSystemAudio} disabled={recording} onCheckedChange={(checked) => setIncludeSystemAudio(checked === true)} /><span><strong className="block">{pick("共享标签页或系统声音", "Shared-tab or system audio")}</strong><span className="mt-1 block text-xs leading-5 text-zinc-500">{pick("是否可录取取决于浏览器和你选择的共享来源。", "Availability depends on the browser and selected share source.")}</span></span></label><label className="flex items-start gap-3 rounded-lg border border-white/10 p-4 text-sm"><Checkbox checked={includeMicrophone} disabled={recording} onCheckedChange={(checked) => setIncludeMicrophone(checked === true)} /><span><strong className="block">{pick("麦克风", "Microphone")}</strong><span className="mt-1 block text-xs leading-5 text-zinc-500">{pick("开启后浏览器会单独请求麦克风权限。", "The browser asks separately for microphone permission.")}</span></span></label></div>
    <div className={`rounded-xl border p-8 text-center ${recording ? "border-rose-400/30 bg-rose-400/[.05]" : "border-white/10"}`}><div className={`mx-auto grid size-16 place-items-center rounded-full ${recording ? "bg-rose-400/10 text-rose-300" : "bg-cyan-300/10 text-cyan-300"}`}>{recording ? <span className="size-4 animate-pulse rounded-full bg-rose-400" /> : <MonitorUp className="size-7" />}</div><p className="mt-4 font-mono text-4xl font-semibold">{formatElapsed(elapsed)}</p><p className="mt-2 text-sm text-zinc-500">{recording ? pick("正在录制；停止共享也会结束录制", "Recording; stopping screen sharing also ends the recording") : pick("不会上传或直播，结果保存在浏览器内存中", "Nothing is uploaded or streamed; the result stays in browser memory")}</p></div>
    <div className="flex justify-center">{recording ? <Button variant="destructive" onClick={stopRecording}><Square />{pick("停止录制", "Stop recording")}</Button> : <Button onClick={startRecording}><Video />{pick("选择屏幕并开始", "Choose a screen and start")}</Button>}</div>
    {error ? <Alert variant="destructive"><MonitorUp /><AlertTitle>{pick("屏幕录制不可用", "Screen recording unavailable")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </CardContent></Card>
  {result ? <Card><CardHeader><CardTitle>{pick("录制结果", "Recording result")}</CardTitle></CardHeader><CardContent className="space-y-4"><video src={result.url} controls className="max-h-[560px] w-full rounded-lg border border-white/10 bg-black object-contain" /><div className="flex flex-wrap items-center gap-3"><Button onClick={() => downloadBlob(result.blob, `tabnative-screen-recording.${result.extension}`)}><Download />{pick("下载录像", "Download recording")}</Button><span className="text-xs text-zinc-500">{formatBytes(result.blob.size)} · {result.blob.type || "video/webm"}</span></div></CardContent></Card> : null}
  <p className="flex items-start gap-2 text-xs leading-5 text-zinc-500"><Mic className="mt-0.5 size-4 shrink-0" />{pick("TabNative 只有在你点击开始后才会调用浏览器共享面板；选择和授权由浏览器处理。", "TabNative opens the browser sharing panel only after you click Start; the browser controls selection and permission.")}</p></div>
}

export function chooseRecordingMimeType() { if (typeof MediaRecorder === "undefined") return ""; return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "" }
export function formatElapsed(seconds: number) { const total = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` }
