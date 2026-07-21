"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eraser,
  FileCheck2,
  LoaderCircle,
  RotateCcw,
  ScanSearch,
  Sparkles,
} from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { inspectImage } from "@/lib/image-inspector"
import { downloadBlob } from "@/lib/image-sanitizer"
import type { ImageInspection } from "@/lib/image-types"
import {
  loadLocalAsset,
  localAssetFile,
  saveLocalAsset,
} from "@/lib/local-asset-transfer"
import {
  cleanAiImageMarks,
  type OneClickAiCleanupResult,
} from "@/lib/one-click-ai-cleaner"
import type { VisibleAiMarkDetection } from "@/lib/visible-watermark"

function providerName(provider: VisibleAiMarkDetection | null) {
  if (!provider) return ""
  if (provider.provider === "gemini") return "Gemini"
  if (provider.provider === "doubao") return "Doubao"
  return "Jimeng"
}

export function OneClickAiCleanerTool() {
  const { pick } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<ImageInspection | null>(null)
  const [postInspection, setPostInspection] = useState<ImageInspection | null>(null)
  const [sourceUrl, setSourceUrl] = useState("")
  const [resultUrl, setResultUrl] = useState("")
  const [result, setResult] = useState<OneClickAiCleanupResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadingHandoff, setLoadingHandoff] = useState(false)
  const [rechecking, setRechecking] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const urlsRef = useRef<string[]>([])
  const handoffAttemptedRef = useRef(false)
  const pickRef = useRef(pick)

  useEffect(() => {
    pickRef.current = pick
  }, [pick])

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const handleFile = useCallback((next: File | null) => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    const nextUrl = next ? URL.createObjectURL(next) : ""
    if (nextUrl) urlsRef.current.push(nextUrl)
    setFile(next)
    setSourceUrl(nextUrl)
    setInspection(null)
    setPostInspection(null)
    setResult(null)
    setResultUrl("")
    setConfirmed(false)
    setRunning(Boolean(next))
    setError("")
    setNotice("")
  }, [])

  useEffect(() => {
    if (handoffAttemptedRef.current || file) return
    handoffAttemptedRef.current = true
    const assetId = new URLSearchParams(window.location.search).get("asset")
    if (!assetId) return
    queueMicrotask(() => {
      setLoadingHandoff(true)
      void loadLocalAsset(assetId).then((record) => {
        if (!record) throw new Error(pickRef.current(
          "临时图片已过期，请从 AI 图片检测结果重新发送。",
          "The temporary image has expired. Send it again from the AI image result.",
        ))
        handleFile(localAssetFile(record))
        setNotice(pickRef.current(
          "已接收刚才检测的图片，确认处理范围后即可开始。",
          "The image from the detector is ready. Review the cleanup scope, then start.",
        ))
      }).catch((reason) => {
        setError(reason instanceof Error ? reason.message : pickRef.current(
          "无法读取检测页面传来的图片。",
          "Unable to load the image from the detector.",
        ))
      }).finally(() => {
        setLoadingHandoff(false)
      })
    })
  }, [file, handleFile, pick])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    void inspectImage(file).then((value) => {
      if (!cancelled) setInspection(value)
    }).catch(() => {
      if (!cancelled) setError(pick(
        "无法读取这张图片的文件信息。",
        "Unable to read this image's file information.",
      ))
    }).finally(() => {
      if (!cancelled) setRunning(false)
    })
    return () => { cancelled = true }
  }, [file, pick])

  async function clean() {
    if (!file || !confirmed || running) return
    setRunning(true)
    setError("")
    setResult(null)
    setPostInspection(null)
    try {
      const cleaned = await cleanAiImageMarks(file)
      if (!cleaned.containerVerified) throw new Error("container-verification-failed")
      if (!cleaned.visibleMarkVerified) throw new Error("visible-mark-verification-failed")
      const cleanedFile = new File([cleaned.blob], cleaned.name, { type: cleaned.blob.type })
      const checked = await inspectImage(cleanedFile)
      const nextUrl = URL.createObjectURL(cleaned.blob)
      urlsRef.current.push(nextUrl)
      setResult(cleaned)
      setResultUrl(nextUrl)
      setPostInspection(checked)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : ""
      setError(message === "container-verification-failed"
        ? pick(
          "输出文件校验没有通过，结果未提供下载。请保留原图并重试。",
          "The output verification failed, so no download was created. Keep the source and try again.",
        )
        : message === "visible-mark-verification-failed"
          ? pick(
            "已自动尝试多次清理，但结果仍未通过本地复检，因此没有提供下载。请换用更清晰、未经截图或重压缩的原图重试。",
            "Automatic cleanup retried several times, but the result still did not pass the local check, so no download was created. Try a clearer source image that has not been screenshotted or heavily recompressed.",
          )
          : pick(
          "本地清理未能完成。请确认图片有效，刷新后重试或使用单项清理工具。",
          "Local cleanup could not finish. Confirm the image is valid, refresh, or use the individual cleanup tools.",
        ))
    } finally {
      setRunning(false)
    }
  }

  async function recheckResult() {
    if (!result || rechecking) return
    setRechecking(true)
    setError("")
    try {
      const assetId = await saveLocalAsset(result.blob, result.name, "ai-cleaner")
      window.location.assign(`/ai-image-detector?asset=${encodeURIComponent(assetId)}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : pick(
        "无法把结果发送到 AI 图片检测。",
        "Unable to send the result to AI image detection.",
      ))
      setRechecking(false)
    }
  }

  const aiSignalCount = inspection?.signals.filter((signal) => signal.group === "ai" || signal.group === "c2pa").length ?? 0
  const remainingSignalCount = postInspection?.signals.filter((signal) => signal.group === "ai" || signal.group === "c2pa").length ?? 0

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-[#0d0d0d] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
            <Eraser className="size-5 text-cyan-300" />
            {pick("选择要清理的图片", "Choose an image to clean")}
          </CardTitle>
          <p className="text-sm leading-6 text-zinc-500">{pick(
            "清理支持的 AI 角标与来源字段，并进行轻量图像交付优化。",
            "Clean supported AI marks and provenance fields, then apply a light image-delivery normalization.",
          )}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingHandoff ? <div role="status" className="flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4 text-sm text-zinc-300">
            <LoaderCircle className="size-4 animate-spin text-cyan-300" />
            {pick("正在接收检测页面的本地图片", "Loading the local image from the detector")}
          </div> : null}
          <FileDropzone file={file} onFile={handleFile} disabled={running || loadingHandoff} maxPixels={24_000_000} />
          {notice ? <Alert className="border-cyan-300/20 bg-cyan-300/[.04] text-zinc-300">
            <CheckCircle2 className="text-cyan-300" />
            <AlertTitle className="text-zinc-100">{pick("图片已就绪", "Image ready")}</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert> : null}
          {error ? <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>{pick("无法完成处理", "Unable to complete processing")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert> : null}
        </CardContent>
      </Card>

      {file && sourceUrl ? <Card className="overflow-hidden border-white/10 bg-[#0d0d0d] shadow-none">
        <div className="grid lg:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]">
          <div className="relative min-h-72 border-b border-white/10 bg-black/35 lg:border-b-0 lg:border-r">
            <Image src={sourceUrl} alt={pick("待清理图片预览", "Image to clean")} fill unoptimized className="object-contain p-4" />
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <Badge variant="outline" className="border-cyan-300/25 text-cyan-200">{pick("一键清理范围", "One-click cleanup scope")}</Badge>
              <h2 className="mt-3 text-xl font-semibold text-zinc-100">{pick("清理 AI 痕迹并优化图像交付", "Clean AI traces and normalize image delivery")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ScopeItem icon={<Sparkles />} title={pick("可见 AI 角标", "Visible AI marks")} description={pick("Gemini、豆包、即梦", "Gemini, Doubao, and Jimeng")} />
              <ScopeItem icon={<FileCheck2 />} title={pick("文件来源标记", "File provenance fields")} description={pick("AI 元数据、C2PA、Made with AI", "AI metadata, C2PA, and Made with AI")} />
              <ScopeItem icon={<ScanSearch />} title={pick("图像交付优化", "Image delivery normalization")} description={pick("重采样、轻量传感器噪声、重新编码", "Resampling, subtle sensor grain, and re-encoding")} />
            </div>
            {inspection ? <div className="grid grid-cols-3 gap-3">
              <Info label={pick("格式", "Format")} value={inspection.format} />
              <Info label={pick("大小", "Size")} value={formatBytes(inspection.bytes)} />
              <Info label={pick("已发现信号", "Signals found")} value={`${aiSignalCount}`} />
            </div> : <p className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />{pick("正在读取文件信息", "Reading file information")}</p>}
            <Alert className="border-amber-300/20 bg-amber-300/[.04] text-zinc-300">
              <AlertTriangle className="text-amber-300" />
              <AlertTitle className="text-zinc-100">{pick("处理边界", "Processing boundary")}</AlertTitle>
              <AlertDescription>{pick(
                "不会伪造相机 EXIF，也不会改变图片的真实来源。交付优化已针对本站检测器复检，但不同平台和模型仍可能得出不同结论。",
                "This does not fabricate camera EXIF or change the image's real origin. The output is verified against this site's visible-mark check, but other platforms and models may still reach different conclusions.",
              )}</AlertDescription>
            </Alert>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4 text-sm leading-6 text-zinc-300">
              <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} className="mt-1" />
              <span>{pick(
                "我拥有处理这张图片的权利，理解来源标记清理不等于改变图片真实来源。",
                "I have the right to process this image and understand that removing provenance marks does not change its real origin.",
              )}</span>
            </label>
            <Button size="lg" onClick={clean} disabled={!confirmed || running || !inspection} className="w-full bg-cyan-300 text-black hover:bg-cyan-200 sm:w-auto">
              {running ? <LoaderCircle className="animate-spin" /> : <Eraser />}
              {running ? pick("正在清理并优化图像交付", "Cleaning and normalizing image delivery") : pick("一键清理 AI 痕迹", "Clean AI traces in one click")}
            </Button>
          </div>
        </div>
      </Card> : null}

      {result && resultUrl ? <Card className="border-emerald-400/20 bg-emerald-400/[.035] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-200"><CheckCircle2 className="size-5" />{pick("一键清理完成", "One-click cleanup complete")}</CardTitle>
          <p className="text-sm leading-6 text-zinc-400">{pick(
            "结果已完成自动清理与复检，可以直接下载或送回检测工具复检。",
            "The result has completed automatic cleanup and verification. Download it directly or send it back to the detector for another check.",
          )}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:min-h-[440px]">
            <Image src={resultUrl} alt={pick("清理结果", "Cleaned result")} fill unoptimized className="object-contain p-4" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Info label={pick("可见角标", "Visible mark")} value={result.visibleMark ? `${providerName(result.visibleMark)} · ${pick("已处理", "Removed")}` : pick("未发现", "Not found")} />
            <Info label={pick("文件来源字段", "Provenance fields")} value={result.metadataResetByReencode || result.metadataRemoved.length ? pick("已清理", "Cleaned") : pick("未发现", "Not found")} />
            <Info label={pick("可见标记复检", "Visible-mark verification")} value={result.visibleMarkVerified ? pick("已通过", "Passed") : pick("未通过", "Failed")} />
            <Info label={pick("复检信号", "Signals after check")} value={`${remainingSignalCount}`} />
            <Info label={pick("结果大小", "Result size")} value={formatBytes(result.blob.size)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => downloadBlob(result.blob, result.name)} className="bg-cyan-300 text-black hover:bg-cyan-200"><Download />{pick("下载清理结果", "Download cleaned image")}</Button>
            <Button size="lg" variant="outline" onClick={recheckResult} disabled={rechecking}>{rechecking ? <LoaderCircle className="animate-spin" /> : <ScanSearch />}{pick("重新检测结果", "Check the cleaned image again")}</Button>
            <Button size="lg" variant="ghost" onClick={() => handleFile(null)}><RotateCcw />{pick("换一张图片", "Try another image")}</Button>
          </div>
        </CardContent>
      </Card> : null}
    </div>
  )
}

function ScopeItem({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4"><span className="mt-0.5 text-cyan-300">{icon}</span><div><p className="text-sm font-semibold text-zinc-100">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p></div></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium text-zinc-100">{value}</p></div>
}
