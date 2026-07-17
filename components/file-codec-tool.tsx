"use client"

import { Binary, Copy, Download, FileKey2, LoaderCircle } from "lucide-react"
import { useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { downloadBlob, fileToDataUrl, formatBytes, safeError } from "@/lib/browser-files"

type Hashes = { sha256: string; sha1: string; md5: string }

export function FileCodecTool() {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [hashes, setHashes] = useState<Hashes | null>(null)
  const [base64, setBase64] = useState("")
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  async function calculate() {
    if (!file) return
    setRunning(true); setError(""); setHashes(null); setProgress(10)
    try {
      const buffer = await file.arrayBuffer(); setProgress(45)
      const [sha256, sha1] = await Promise.all([crypto.subtle.digest("SHA-256", buffer), crypto.subtle.digest("SHA-1", buffer)])
      setProgress(75)
      const SparkMD5 = (await import("spark-md5")).default
      const md5 = SparkMD5.ArrayBuffer.hash(buffer)
      setHashes({ sha256: toHex(sha256), sha1: toHex(sha1), md5 }); setProgress(100)
    } catch (reason) { setError(safeError(reason, pick("文件校验失败", "File hashing failed"))) }
    finally { setRunning(false) }
  }

  async function encode() {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { setError(pick("Base64 转换请使用 50 MB 以内文件", "Base64 conversion supports files up to 50 MB")); return }
    setRunning(true); setError("")
    try { setBase64(await fileToDataUrl(file)) } catch (reason) { setError(safeError(reason, pick("转换失败", "Conversion failed"))) }
    finally { setRunning(false) }
  }

  function decode() {
    try {
      const match = base64.trim().match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/)
      const mime = match?.[1] || "application/octet-stream"; const raw = match?.[2] || base64.trim()
      const binary = atob(raw.replace(/\s/g, "")); const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
      downloadBlob(new Blob([bytes], { type: mime }), "tabnative-decoded-file")
    } catch { setError(pick("Base64 内容无效", "Invalid Base64 content")) }
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("文件校验", "File checksum")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 hover:border-cyan-300/40"><FileKey2 className="mb-2 text-cyan-300" /><span className="text-sm">{file ? `${file.name} · ${formatBytes(file.size)}` : pick("选择要校验的文件", "Choose a file to hash")}</span><input className="sr-only" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setHashes(null); setError("") }} /></label>
      <div className="flex flex-wrap gap-2"><Button onClick={calculate} disabled={!file || running}>{running ? <LoaderCircle className="animate-spin" /> : <FileKey2 />}{pick("计算校验值", "Calculate checksums")}</Button><Button variant="outline" onClick={encode} disabled={!file || running}><Binary />{pick("文件转 Base64", "File to Base64")}</Button></div>
      {running ? <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} /></div> : null}
      {hashes ? <div className="space-y-2"><HashRow label="SHA-256" value={hashes.sha256} /><HashRow label="SHA-1" value={hashes.sha1} /><HashRow label="MD5" value={hashes.md5} warning={pick("仅用于兼容校验", "Compatibility only")} /></div> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{pick("Base64 编解码", "Base64 encode and decode")}</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={base64} onChange={(event) => setBase64(event.target.value)} className="min-h-56 font-mono text-xs" placeholder="data:application/octet-stream;base64,..." /><div className="flex flex-wrap gap-2"><Button onClick={() => navigator.clipboard.writeText(base64)} disabled={!base64}><Copy />{pick("复制", "Copy")}</Button><Button variant="outline" onClick={decode} disabled={!base64}><Download />{pick("还原并下载文件", "Decode and download")}</Button></div></CardContent></Card>
    {error ? <Alert variant="destructive"><Binary /><AlertTitle>{pick("无法完成", "Unable to complete")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
  </div>
}

function HashRow({ label, value, warning }: { label: string; value: string; warning?: string }) {
  const { pick } = useLanguage()
  return <div className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-[100px_1fr_auto]"><span className="text-sm font-semibold">{label}</span><code className="break-all text-xs text-zinc-400">{value}</code><button className="text-xs text-cyan-300" onClick={() => navigator.clipboard.writeText(value)}>{pick("复制", "Copy")} {warning ? `· ${warning}` : ""}</button></div>
}
function toHex(buffer: ArrayBuffer) { return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("") }
