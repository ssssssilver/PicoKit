"use client"

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FileSearch,
  Fingerprint,
  LoaderCircle,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldQuestion,
} from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState, type RefObject } from "react"

import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  attachVisibleAiMarkEvidence,
  buildImageViewPlan,
  calibratedPixelAiLikelihood,
  fuseImageDetection,
  IMAGE_PIXEL_DETECTOR_VERSION,
  IMAGE_PIXEL_MODEL_ID,
  IMAGE_PIXEL_MODEL_REVISION,
  IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
  IMAGE_PIXEL_SECONDARY_MODEL_ID,
  IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
  IMAGE_PIXEL_TERTIARY_DETECTOR_VERSION,
  IMAGE_PIXEL_TERTIARY_MODEL_ID,
  IMAGE_PIXEL_TERTIARY_MODEL_REVISION,
  pixelEstimateBand,
  type FusedImageDetection,
  type PixelDetectionResult,
} from "@/lib/image-detector-core"
import { validateImageFile } from "@/lib/file-validation"
import { inspectImage } from "@/lib/image-inspector"
import { localizedImageSignalLabel } from "@/lib/image-signal-label"
import type { ImageInspection, ImageSignal } from "@/lib/image-types"
import { loadLocalAsset, localAssetFile } from "@/lib/local-asset-transfer"
import {
  detectVisibleAiPlatformMark,
  type VisibleAiMarkDetection,
} from "@/lib/visible-watermark"

type WorkerMessage = {
  type: "progress" | "status" | "result" | "error"
  tier?: "primary" | "secondary" | "tertiary"
  progress?: number
  file?: string
  stage?: string
  views?: number
  result?: PixelDetectionResult
  error?: string
}

export type DetectionChannelStatus = "available" | "unavailable" | "not-run"

export type DetectionChannelAvailability = {
  provenance: DetectionChannelStatus
  visibleMark: DetectionChannelStatus
  pixel: DetectionChannelStatus
}

export type EvidenceSummaryKind =
  | "file-evidence"
  | "visual-clue"
  | "statistical-estimate"
  | "insufficient"

export type SimpleImageClassification =
  | "ai-generated"
  | "not-ai-generated"

export const IMAGE_EVIDENCE_REPORT_VERSION = "1.7.0"
export const PROVENANCE_DETECTOR_VERSION = "exif-c2pa-inspector/3"
export const VISIBLE_MARK_DETECTOR_VERSION = "platform-mark-matcher/2"
export const IMAGE_INSPECTOR_MAX_BYTES = 25 * 1024 * 1024
export const IMAGE_INSPECTOR_MAX_PIXELS = 24_000_000

const INITIAL_CHANNELS: DetectionChannelAvailability = {
  provenance: "not-run",
  visibleMark: "not-run",
  pixel: "not-run",
}

const SHOW_INLINE_TECHNICAL_REPORT = false

const REPORT_LIMITATIONS = [
  {
    zh: "像素模型及其组合仍是统计估计，会受到压缩、裁剪、编辑方式、新生成器和图片类型影响。",
    en: "Pixel models and their combined output remain statistical estimates affected by compression, crops, edits, new generators, and image type.",
  },
  {
    zh: "可见标记通道只检查当前支持的 Gemini、豆包和即梦角标，不检查 SynthID 等不可见水印。",
    en: "The visible-mark channel checks supported Gemini, Doubao, and Jimeng marks; it does not inspect invisible watermarks such as SynthID.",
  },
  {
    zh: "没有 EXIF、C2PA 或平台标记不代表图片一定由真人创作，也不代表图片直接来自相机。",
    en: "Missing EXIF, C2PA, or platform marks does not prove human authorship or a camera-original file.",
  },
  {
    zh: "本报告不能单独用于处罚、版权归属、作者身份或事实真实性判断。",
    en: "This report must not be the sole basis for penalties, copyright, authorship, or factual-authenticity decisions.",
  },
] as const

function isVisibleMarkSignal(signal: ImageSignal) {
  return signal.id.startsWith("visible-ai-mark-")
}

function explicitAiFileSignals(inspection: ImageInspection | null) {
  return (
    inspection?.signals.filter(
      (signal) => signal.group === "ai" && !isVisibleMarkSignal(signal),
    ) ?? []
  )
}

export function summarizeImageEvidence({
  inspection,
  pixel,
  visibleMark,
}: {
  inspection: ImageInspection | null
  pixel: PixelDetectionResult | null
  visibleMark: VisibleAiMarkDetection | null
}) {
  const fileSignals = explicitAiFileSignals(inspection)
  let kind: EvidenceSummaryKind = "insufficient"
  if (fileSignals.length) kind = "file-evidence"
  else if (visibleMark) kind = "visual-clue"
  else if (pixel) kind = "statistical-estimate"
  return {
    kind,
    explicitAiFileSignalCount: fileSignals.length,
    c2paPresent: inspection?.c2pa.present ?? false,
    visiblePlatformMarkFound: Boolean(visibleMark),
    pixelEstimateAvailable: Boolean(pixel),
  }
}

export function getSimpleImageVerdict({
  inspection,
  pixel,
  visibleMark,
}: {
  inspection: ImageInspection | null
  pixel: PixelDetectionResult | null
  visibleMark: VisibleAiMarkDetection | null
}) {
  const fused = inspection ? fuseImageDetection(pixel, inspection) : null
  const pixelBand = pixel ? pixelEstimateBand(pixel) : null
  const reliability = fused?.reliability
    ?? (visibleMark || (pixelBand !== null && pixelBand !== "uncertain" && (pixel?.consistency ?? 0) >= 0.6)
      ? "medium"
      : "low")
  const rawAiLikelihood = fused?.overallScore
    ?? (visibleMark ? Math.max(0.94, visibleMark.confidence) : calibratedPixelAiLikelihood(pixel))
  const classification: SimpleImageClassification = fused
    ? fused.band === "higher-ai-signals"
      ? "ai-generated"
      : "not-ai-generated"
    : visibleMark
      ? "ai-generated"
      : pixelBand === "higher"
        ? "ai-generated"
        : "not-ai-generated"
  const aiGenerated = classification === "ai-generated"
  // The product verdict is intentionally binary. When the evidence does not
  // cross the AI threshold, keep the user-facing likelihood below 50% while
  // preserving every raw model score and disagreement in the download report.
  const aiLikelihood = aiGenerated ? rawAiLikelihood : Math.min(rawAiLikelihood, 0.49)

  return {
    aiGenerated,
    classification,
    reliability,
    aiLikelihood,
    aiLikelihoodPercent: Math.round(aiLikelihood * 100),
  }
}

export function buildImageEvidenceReport({
  createdAt = new Date().toISOString(),
  inspectedAt,
  file,
  inspection,
  pixel,
  visibleMark,
  channels,
}: {
  createdAt?: string
  inspectedAt?: string | null
  file: {
    name: string
    type: string
    bytes: number
    sha256?: string | null
    width?: number | null
    height?: number | null
  } | null
  inspection: ImageInspection | null
  pixel: PixelDetectionResult | null
  visibleMark: VisibleAiMarkDetection | null
  channels: DetectionChannelAvailability
}) {
  const summary = summarizeImageEvidence({ inspection, pixel, visibleMark })
  const verdict = getSimpleImageVerdict({ inspection, pixel, visibleMark })
  const relationship = inspection
    ? fuseImageDetection(pixel, inspection).evidenceAgreement
    : "insufficient"
  return {
    schema: "tabnative.image-source-evidence",
    version: IMAGE_EVIDENCE_REPORT_VERSION,
    createdAt,
    inspectedAt: inspection?.inspectedAt ?? inspectedAt ?? null,
    file: file ? {
      ...file,
      sha256: inspection?.sha256 ?? file.sha256 ?? null,
      width: inspection?.width ?? file.width ?? null,
      height: inspection?.height ?? file.height ?? null,
    } : null,
    summary: {
      ...summary,
      classification: verdict.classification,
      reliability: verdict.reliability,
      aiLikelihood: verdict.aiLikelihood,
      aiLikelihoodPercent: verdict.aiLikelihoodPercent,
      likelihoodCalibration: "evidence-weighted-likelihood-v1",
      evidenceRelationship: relationship,
    },
    channels: {
      fileEvidence: {
        status: channels.provenance,
        detector: PROVENANCE_DETECTOR_VERSION,
        metadataFieldCount: inspection?.metadata.length ?? null,
        c2pa: inspection?.c2pa ?? null,
        signals:
          inspection?.signals.filter((signal) => !isVisibleMarkSignal(signal)) ??
          [],
      },
      visiblePlatformMarks: {
        status: channels.visibleMark,
        detector: VISIBLE_MARK_DETECTOR_VERSION,
        supportedProviders: ["gemini", "doubao", "jimeng"],
        result: visibleMark,
      },
      pixelStatistics: {
        status: channels.pixel,
        detector: {
          identifier: IMAGE_PIXEL_DETECTOR_VERSION,
          model: IMAGE_PIXEL_MODEL_ID,
          revision: IMAGE_PIXEL_MODEL_REVISION,
          backend: pixel?.backend ?? null,
          secondary: {
            identifier: IMAGE_PIXEL_SECONDARY_DETECTOR_VERSION,
            model: IMAGE_PIXEL_SECONDARY_MODEL_ID,
            revision: IMAGE_PIXEL_SECONDARY_MODEL_REVISION,
          },
          tertiary: {
            identifier: IMAGE_PIXEL_TERTIARY_DETECTOR_VERSION,
            model: IMAGE_PIXEL_TERTIARY_MODEL_ID,
            revision: IMAGE_PIXEL_TERTIARY_MODEL_REVISION,
          },
          cascade: pixel?.cascade ?? null,
          models: pixel?.models?.map((model) => ({
            identifier: model.model,
            backend: model.backend,
          })) ?? [],
        },
        result: pixel,
      },
    },
    limitations: REPORT_LIMITATIONS,
  }
}

export function buildReadableImageEvidenceReport({
  language,
  file,
  inspection,
  pixel,
  visibleMark,
  channels,
}: {
  language: string
  file: File | null
  inspection: ImageInspection | null
  pixel: PixelDetectionResult | null
  visibleMark: VisibleAiMarkDetection | null
  channels: DetectionChannelAvailability
}) {
  const zh = language.startsWith("zh")
  const summary = summarizeImageEvidence({ inspection, pixel, visibleMark })
  const verdict = getSimpleImageVerdict({ inspection, pixel, visibleMark })
  const relationship = inspection
    ? fuseImageDetection(pixel, inspection).evidenceAgreement
    : "insufficient"
  const fileSignals = explicitAiFileSignals(inspection)
  const pixelModels = pixel?.models?.length ? pixel.models : pixel ? [pixel] : []
  const lines = [
    zh ? "# TabNative 图片来源证据摘要" : "# TabNative Image Source-Evidence Summary",
    "",
    `${zh ? "生成时间" : "Created"}: ${new Date().toISOString()}`,
    `${zh ? "文件" : "File"}: ${file?.name ?? (zh ? "未知" : "Unknown")}`,
    `${zh ? "图像尺寸" : "Image dimensions"}: ${inspection?.width && inspection?.height ? `${inspection.width} × ${inspection.height} px` : (zh ? "未读取" : "Unavailable")}`,
    `SHA-256: ${inspection?.sha256 ?? (zh ? "未读取" : "Unavailable")}`,
    `${zh ? "报告版本" : "Report version"}: ${IMAGE_EVIDENCE_REPORT_VERSION}`,
    "",
    `## ${zh ? "结论概览" : "Evidence overview"}`,
    "",
    `${zh ? "检测结果" : "Detection result"}: ${readableVerdict(verdict.classification, zh)}`,
    `${zh ? "AI 可能性" : "AI likelihood"}: ${verdict.aiLikelihoodPercent}%`,
    `${zh ? "检测可信度" : "Confidence"}: ${readableReliability(verdict.reliability, zh)}`,
    `${zh ? "主要证据级别" : "Primary evidence level"}: ${readableSummaryKind(summary.kind, zh)}`,
    `${zh ? "证据关系" : "Evidence relationship"}: ${readableRelationship(relationship, zh)}`,
    "",
    `## ${zh ? "三个检测通道" : "Three detection channels"}`,
    "",
    `- ${zh ? "文件来源" : "File provenance"}: ${readableChannelStatus(channels.provenance, zh)}${fileSignals.length ? ` · ${zh ? "明确记录" : "explicit records"} ${fileSignals.length}` : ""}`,
    `- ${zh ? "可见平台标记" : "Visible platform marks"}: ${readableChannelStatus(channels.visibleMark, zh)}${visibleMark ? ` · ${providerLabel(visibleMark.provider)} ${Math.round(visibleMark.confidence * 100)}%` : ""}`,
    `- ${zh ? "像素统计" : "Pixel statistics"}: ${readableChannelStatus(channels.pixel, zh)}${pixel ? ` · ${readablePixelBand(pixelEstimateBand(pixel), zh)} · ${zh ? "原始输出" : "raw output"} ${Math.round(pixel.score * 100)}%` : ""}`,
  ]
  if (inspection?.c2pa.present) {
    lines.push(
      "",
      `## C2PA`,
      "",
      `- ${zh ? "验证状态" : "Validation state"}: ${inspection.c2pa.validationState ?? "unknown"}`,
      `- ${zh ? "来源信任" : "Signer trust"}: ${inspection.c2pa.trust ?? "unknown"}`,
    )
  }
  if (fileSignals.length) {
    lines.push("", `## ${zh ? "文件中的明确记录" : "Explicit file records"}`, "")
    for (const signal of fileSignals) lines.push(`- ${signal.label}: ${signal.value}`)
  }
  if (pixel) {
    lines.push(
      "",
      `## ${zh ? "像素通道详情" : "Pixel-channel details"}`,
      "",
      `- ${zh ? "区域一致性" : "Region consistency"}: ${Math.round(pixel.consistency * 100)}%`,
      `- ${zh ? "区域差异" : "Regional spread"}: ${Math.round(pixel.spread * 100)} ${zh ? "个百分点" : "points"}`,
      `- ${zh ? "模型一致性" : "Model agreement"}: ${Math.round((pixel.modelAgreement ?? 1) * 100)}%`,
      `- ${zh ? "检测层级" : "Detection stages"}: ${pixelModels.length}`,
      `- ${zh ? "综合推理后端" : "Combined inference backend"}: ${pixel.backend}`,
    )
    pixelModels.forEach((model, index) => {
      const stageName = [
        zh ? "快速检测" : "Fast check",
        zh ? "增强检测" : "Enhanced check",
        zh ? "最终复核" : "Final verification",
      ][index] ?? (zh ? `检测 ${index + 1}` : `Check ${index + 1}`)
      lines.push(
        `- ${stageName}: ${readablePixelBand(pixelEstimateBand(model), zh)} · ${zh ? "原始输出" : "raw output"} ${Math.round(model.score * 100)}% · ${model.backend}`,
      )
    })
    if (pixel.cascade?.secondary === "unavailable") {
      lines.push(`- ${zh ? "增强检测状态" : "Enhanced-check status"}: ${zh ? "本次不可用，已保留快速检测结果" : "Unavailable this run; the fast-check result was preserved"}`)
    }
    if (pixel.cascade?.tertiary === "unavailable") {
      lines.push(`- ${zh ? "最终复核状态" : "Final-verification status"}: ${zh ? "本次不可用，已保留前两次检测结果" : "Unavailable this run; the first two check results were preserved"}`)
    }
  }
  lines.push(
    "",
    `## ${zh ? "使用限制" : "Limitations"}`,
    "",
    zh
      ? "AI 可能性是来源凭证、平台标记与像素模型经保守校准后的估计，不是作者身份或事实真实性证明，也不能单独用于处罚或版权归属判断。"
      : "AI likelihood is a conservatively calibrated estimate from provenance, platform marks, and pixel models. It is not proof of authorship or factual authenticity and must not be the sole basis for penalties or copyright decisions.",
    "",
  )
  return lines.join("\n")
}

async function settleChannel<T>(operation: Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: "fulfilled", value: await operation }
  } catch (reason) {
    return { status: "rejected", reason }
  }
}

export function ImageInspectorTool() {
  const { language, pick, format } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [inspection, setInspection] = useState<ImageInspection | null>(null)
  const [pixel, setPixel] = useState<PixelDetectionResult | null>(null)
  const [visibleMark, setVisibleMark] =
    useState<VisibleAiMarkDetection | null>(null)
  const [channels, setChannels] =
    useState<DetectionChannelAvailability>(INITIAL_CHANNELS)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [, setStatus] = useState("")
  const [notice, setNotice] = useState("")
  const [inspectedAt, setInspectedAt] = useState<string | null>(null)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [reportExporting, setReportExporting] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const pixelCancelRef = useRef<(() => void) | null>(null)
  const analysisAbortRef = useRef<AbortController | null>(null)
  const previewRef = useRef("")
  const runRef = useRef(0)
  const handoffAttemptedRef = useRef(false)
  const reportHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(
    () => () => {
      runRef.current += 1
      analysisAbortRef.current?.abort()
      analysisAbortRef.current = null
      pixelCancelRef.current?.()
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  useEffect(() => {
    if (handoffAttemptedRef.current || file) return
    handoffAttemptedRef.current = true
    const assetId = new URLSearchParams(window.location.search).get("asset")
    if (!assetId) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setHandoffLoading(true)
      setNotice("")
      try {
        const record = await loadLocalAsset(assetId)
        if (!record) {
          throw new Error(
            pick(
              "临时图片已过期，请从上一步重新发送。",
              "The temporary image has expired. Send it again from the previous tool.",
            ),
          )
        }
        const incoming = localAssetFile(record)
        if (incoming.size > IMAGE_INSPECTOR_MAX_BYTES) {
          throw new Error(
            format("文件不能超过 {size}MB", "File cannot exceed {size}MB", {
              size: 25,
            }),
          )
        }
        const validated = await validateImageFile(
          incoming,
          IMAGE_INSPECTOR_MAX_PIXELS,
        )
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(validated.mime)
        ) {
          throw new Error(
            pick(
              "暂不支持这个图片格式。",
              "This image format is not supported.",
            ),
          )
        }
        if (cancelled) return
        setHandoffLoading(false)
        handleFile(validated.file)
      } catch (reason) {
        if (cancelled) return
        setNotice(
          reason instanceof Error
            ? reason.message
            : pick(
                "无法读取上一步的图片。",
                "Unable to read the image from the previous tool.",
              ),
        )
        setHandoffLoading(false)
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [file, format, pick])

  const hasReport = Object.values(channels).some(
    (channel) => channel === "available",
  )

  useEffect(() => {
    if (!hasReport || running) return
    const frame = window.requestAnimationFrame(() => reportHeadingRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [hasReport, running])

  function handleFile(next: File | null) {
    runRef.current += 1
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    pixelCancelRef.current?.()
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next ? URL.createObjectURL(next) : ""
    setPreviewUrl(previewRef.current)
    setFile(next)
    setInspection(null)
    setPixel(null)
    setVisibleMark(null)
    setChannels(INITIAL_CHANNELS)
    setRunning(false)
    setProgress(0)
    setStatus("")
    setNotice("")
    setInspectedAt(null)
  }

  async function analyze() {
    if (!file) return
    analysisAbortRef.current?.abort()
    pixelCancelRef.current?.()
    const abortController = new AbortController()
    analysisAbortRef.current = abortController
    const runId = ++runRef.current
    const analysisStartedAt = new Date().toISOString()
    setRunning(true)
    setProgress(2)
    setStatus(
      pick(
        "正在读取来源证据并准备本地检测",
        "Reading provenance and preparing local detection",
      ),
    )
    setNotice("")
    setInspection(null)
    setPixel(null)
    setVisibleMark(null)
    setChannels(INITIAL_CHANNELS)
    setInspectedAt(analysisStartedAt)

    // Keep peak memory predictable: each heavy channel releases its decoded
    // image before the next channel starts.
    const inspectionOutcome = await settleChannel(inspectImage(file, {
      signal: abortController.signal,
    }))
    if (runRef.current !== runId || abortController.signal.aborted) return

    const baseInspection = inspectionOutcome.status === "fulfilled"
      ? inspectionOutcome.value
      : null
    setProgress(28)
    setStatus(pick("可见平台标记", "Visible platform marks"))
    const visibleMarkOutcome = await settleChannel(detectVisibleAiPlatformMark(file, {
      sourceWidth: baseInspection?.width,
      sourceHeight: baseInspection?.height,
      signal: abortController.signal,
    }))
    if (runRef.current !== runId || abortController.signal.aborted) return

    const nextVisibleMark =
      visibleMarkOutcome.status === "fulfilled"
        ? visibleMarkOutcome.value
        : null
    const hasExplicitAiEvidence =
      explicitAiFileSignals(baseInspection).some((signal) => signal.severity === "high") ||
      Boolean(nextVisibleMark)
    setProgress(52)
    setStatus(pick("像素统计", "Pixel statistics"))
    const pixelOutcome = await settleChannel(
      runPixelDetection(file, abortController.signal, !hasExplicitAiEvidence),
    )
    if (runRef.current !== runId || abortController.signal.aborted) return
    const nextInspection = baseInspection
      ? attachVisibleAiMarkEvidence(baseInspection, nextVisibleMark)
      : null
    const nextPixel =
      pixelOutcome.status === "fulfilled" ? pixelOutcome.value : null
    const nextChannels: DetectionChannelAvailability = {
      provenance:
        inspectionOutcome.status === "fulfilled" ? "available" : "unavailable",
      visibleMark:
        visibleMarkOutcome.status === "fulfilled" ? "available" : "unavailable",
      pixel: pixelOutcome.status === "fulfilled" ? "available" : "unavailable",
    }

    setInspection(nextInspection)
    setPixel(nextPixel)
    setVisibleMark(nextVisibleMark)
    setChannels(nextChannels)
    setProgress(100)
    setStatus(pick("本地分析完成", "Local analysis complete"))
    setRunning(false)
    if (analysisAbortRef.current === abortController) analysisAbortRef.current = null

    const unavailableCount = Object.values(nextChannels).filter(
      (channel) => channel === "unavailable",
    ).length
    if (unavailableCount === 3) {
      setNotice(
        pick(
          "本次没有生成报告。图片仍保留在你的设备上，可以重试或换用 PNG、JPG、WebP。",
          "No report was created this time. The image remains on your device; retry or use PNG, JPG, or WebP.",
        ),
      )
    } else if (unavailableCount) {
      setNotice(
        format(
          "有 {count} 个分析通道本次未完成；其余通道的结果已保留，并会明确标注可用性。",
          "{count} analysis channel(s) did not finish. Results from the other channels are preserved and availability is shown explicitly.",
          { count: unavailableCount },
        ),
      )
    }
  }

  function runPixelDetection(
    source: File,
    signal?: AbortSignal,
    allowCascade = true,
  ) {
    pixelCancelRef.current?.()
    return new Promise<PixelDetectionResult>((resolve, reject) => {
      let worker: Worker | null = null
      let settled = false
      const finish = (result: { value: PixelDetectionResult } | { error: Error }) => {
        if (settled) return
        settled = true
        signal?.removeEventListener("abort", cancelPixel)
        worker?.terminate()
        if (workerRef.current === worker) workerRef.current = null
        if (pixelCancelRef.current === cancelPixel) pixelCancelRef.current = null
        if ("value" in result) resolve(result.value)
        else reject(result.error)
      }
      const cancelPixel = () => {
        const error = new Error("Image detection cancelled")
        error.name = "AbortError"
        finish({ error })
      }
      if (signal?.aborted) {
        cancelPixel()
        return
      }
      try {
        worker = new Worker(
          new URL("../workers/image-detector.worker.ts", import.meta.url),
          { type: "module" },
        )
      } catch (reason) {
        finish({
          error: reason instanceof Error
            ? reason
            : new Error("Image detector worker failed to start"),
        })
        return
      }
      const activeWorker = worker
      workerRef.current = activeWorker
      pixelCancelRef.current = cancelPixel
      signal?.addEventListener("abort", cancelPixel, { once: true })
      activeWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (message.type === "progress") {
          const modelProgress = Math.max(
            0,
            Math.min(100, Number(message.progress) || 0),
          )
          if (message.tier === "tertiary") {
            setProgress((current) => Math.max(current, 88 + modelProgress * 0.1))
            setStatus(pick("正在准备最终复核", "Preparing final check"))
          } else if (message.tier === "secondary") {
            setProgress((current) => Math.max(current, 74 + modelProgress * 0.12))
            setStatus(pick("正在准备增强检测", "Preparing enhanced check"))
          } else {
            setProgress((current) => Math.max(current, 52 + modelProgress * 0.18))
            setStatus(pick("正在准备快速检测", "Preparing fast check"))
          }
        }
        if (message.type === "status") {
          if (message.stage === "decoding-image") {
            setProgress((value) => Math.max(value, 74))
            setStatus(pick("正在解码图片", "Decoding image"))
          }
          if (message.stage === "analyzing-views") {
            setProgress((value) => Math.max(value, 78))
            setStatus(
              format(
                "正在进行快速检测（{count} 个区域）",
                "Running fast check ({count} regions)",
                { count: message.views || 1 },
              ),
            )
          }
          if (message.stage === "preparing-model" && message.tier === "secondary") {
            setProgress((value) => Math.max(value, 74))
            setStatus(pick("正在准备增强检测", "Preparing enhanced check"))
          }
          if (message.stage === "analyzing-secondary") {
            setProgress((value) => Math.max(value, 86))
            setStatus(pick("正在进行增强检测", "Running enhanced check"))
          }
          if (message.stage === "preparing-model" && message.tier === "tertiary") {
            setProgress((value) => Math.max(value, 88))
            setStatus(pick("正在准备最终复核", "Preparing final check"))
          }
          if (message.stage === "analyzing-tertiary") {
            setProgress((value) => Math.max(value, 98))
            setStatus(pick("正在进行最终复核", "Running final check"))
          }
        }
        if (message.type === "result" && message.result) finish({ value: message.result })
        if (message.type === "error") {
          finish({ error: new Error(message.error || "Image model inference failed") })
        }
      }
      activeWorker.onerror = () =>
        finish({ error: new Error("Image detector worker failed to start") })
      void source.arrayBuffer().then((buffer) => {
        if (settled || signal?.aborted) return
        const nav = navigator as Navigator & { gpu?: unknown }
        activeWorker.postMessage(
          {
            type: "analyze",
            buffer,
            mime: source.type,
            preferWebGpu: Boolean(nav.gpu),
            allowCascade,
          },
          [buffer],
        )
      }).catch((reason) => {
        finish({ error: reason instanceof Error ? reason : new Error("Unable to read image data") })
      })
    })
  }

  function cancel() {
    runRef.current += 1
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    pixelCancelRef.current?.()
    setRunning(false)
    setProgress(0)
    setStatus(pick("已取消", "Cancelled"))
  }

  function exportReport() {
    if (!hasReport) return
    const report = buildImageEvidenceReport({
      inspectedAt,
      file: file
        ? { name: file.name, type: file.type, bytes: file.size }
        : null,
      inspection,
      pixel,
      visibleMark,
      channels,
    })
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `tabnative-source-evidence-${Date.now()}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportReadableReport() {
    if (!hasReport || reportExporting) return
    setReportExporting(true)
    try {
      const content = buildReadableImageEvidenceReport({
        language,
        file,
        inspection,
        pixel,
        visibleMark,
        channels,
      })
      const { buildImageEvidencePdf } = await import("@/lib/image-evidence-pdf")
      const bytes = await buildImageEvidencePdf(content, language)
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const blob = new Blob([buffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `tabnative-image-evidence-${Date.now()}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setNotice(pick("无法生成 PDF 检测报告，请重试。", "Unable to create the PDF detection report. Please try again."))
    } finally {
      setReportExporting(false)
    }
  }

  return (
    <div className="space-y-6" aria-busy={running}>
      <Card className={hasReport ? "hidden" : "border-white/10 bg-[#0d0d0d] shadow-sm"}>
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">
            {pick("上传待检查图片", "Choose an image to inspect")}
          </CardTitle>
          <p className="mt-1.5 text-sm leading-6 text-zinc-500">
            {pick(
              "选择一张图片，检测它是否由 AI 生成。图片只在当前设备处理，不会上传。",
              "Choose an image to check whether it was AI-generated. It stays on this device and is never uploaded.",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {handoffLoading ? (
            <div className="flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4 text-sm text-zinc-300">
              <LoaderCircle className="size-4 animate-spin text-cyan-300" />
              {pick(
                "正在读取上一步的本地图片并校验文件内容",
                "Loading the local image from the previous tool and validating its contents",
              )}
            </div>
          ) : null}
          <FileDropzone
            file={file}
            onFile={handleFile}
            disabled={running || handoffLoading}
            maxBytes={IMAGE_INSPECTOR_MAX_BYTES}
            maxPixels={IMAGE_INSPECTOR_MAX_PIXELS}
          />
          {file && previewUrl ? (
            <div className="grid gap-5 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="relative h-40 overflow-hidden rounded-lg bg-black">
                <Image
                  src={previewUrl}
                  alt={pick("待检查图片预览", "Image preview")}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <div className="flex min-w-0 flex-col justify-center">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {file.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatBytes(file.size)} · {file.type}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button size="lg" onClick={analyze} disabled={running}>
                    <Play />
                    {pick("开始检测", "Start local detection")}
                  </Button>
                  {running ? (
                    <Button variant="outline" size="lg" onClick={cancel}>
                      <RotateCcw />
                      {pick("取消", "Cancel")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {running ? (
            <div className="space-y-2" role="status" aria-live="polite" aria-atomic="true">
              <div className="flex items-center justify-between gap-4 text-xs text-zinc-500">
                <span className="flex min-w-0 items-center gap-2">
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin text-cyan-300" />
                  <span className="truncate">{pick("正在检测图片", "Analyzing locally")}</span>
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ) : null}
          {notice ? (
            <Alert className="border-amber-300/25 bg-amber-300/[.04]">
              <AlertTriangle className="text-amber-300" />
              <AlertTitle>
                {hasReport
                  ? pick("部分通道未完成", "Some channels did not finish")
                  : pick("提示", "Notice")}
              </AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {hasReport ? (
        <SourceEvidenceReport
          inspection={inspection}
          pixel={pixel}
          visibleMark={visibleMark}
          channels={channels}
          onExport={exportReport}
          onExportReadable={exportReadableReport}
          reportExporting={reportExporting}
          onTryAnother={() => handleFile(null)}
          headingRef={reportHeadingRef}
          previewUrl={previewUrl}
          fileName={file?.name ?? ""}
        />
      ) : null}
    </div>
  )
}

function SourceEvidenceReport({
  inspection,
  pixel,
  visibleMark,
  channels,
  onExport,
  onExportReadable,
  reportExporting,
  onTryAnother,
  headingRef,
  previewUrl,
  fileName,
}: {
  inspection: ImageInspection | null
  pixel: PixelDetectionResult | null
  visibleMark: VisibleAiMarkDetection | null
  channels: DetectionChannelAvailability
  onExport: () => void
  onExportReadable: () => void | Promise<void>
  reportExporting: boolean
  onTryAnother: () => void
  headingRef: RefObject<HTMLHeadingElement | null>
  previewUrl: string
  fileName: string
}) {
  const { pick, format } = useLanguage()
  const [selectedView, setSelectedView] = useState("full")
  const summary = summarizeImageEvidence({ inspection, pixel, visibleMark })
  const summaryCopy = getSummaryCopy(summary.kind, pick)
  const fileAiSignals = explicitAiFileSignals(inspection)
  const supportingSignals =
    inspection?.signals.filter(
      (signal) => signal.group !== "ai" && !isVisibleMarkSignal(signal),
    ) ?? []
  const relationship = inspection
    ? fuseImageDetection(pixel, inspection).evidenceAgreement
    : "insufficient"
  const relationshipCopy = getRelationshipCopy(relationship, pick)
  const pixelBand = pixel ? pixelEstimateBand(pixel) : null
  const pixelModels = pixel?.models?.length ? pixel.models : pixel ? [pixel] : []
  const verdict = getSimpleImageVerdict({ inspection, pixel, visibleMark })
  const confidenceLabel = verdict.reliability === "high"
    ? pick("高", "High")
    : verdict.reliability === "medium"
      ? pick("中", "Medium")
      : pick("有限", "Limited")
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="grid lg:min-h-[500px] lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
            <div className="flex min-h-80 flex-col border-b border-border bg-muted/25 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="relative min-h-72 flex-1 overflow-hidden rounded-xl bg-black/[.04] dark:bg-black/35">
                <Image
                  src={previewUrl}
                  alt={pick("待检查图片预览", "Image preview")}
                  fill
                  unoptimized
                  className="object-contain p-3"
                />
              </div>
              {fileName ? <p className="mt-3 truncate text-center text-sm font-medium text-muted-foreground">{fileName}</p> : null}
            </div>

            <div className="flex flex-col justify-center gap-5 p-5 sm:p-7">
              <div className={verdict.aiGenerated
                ? "rounded-xl border border-red-300 bg-red-50 p-5 text-red-950 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-100"
                : "rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100"}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium opacity-75">{pick("检测结果", "Result")}</p>
                    <h2
                      ref={headingRef}
                      tabIndex={-1}
                      className="mt-2 scroll-mt-24 text-3xl font-bold tracking-tight outline-none"
                    >
                      {verdict.aiGenerated
                        ? pick("是 AI 生成", "AI-generated")
                        : pick("不是 AI 生成", "Not AI-generated")}
                    </h2>
                  </div>
                  <span className={verdict.aiGenerated
                    ? "shrink-0 rounded-full bg-red-200 px-4 py-2 text-sm font-bold tabular-nums text-red-700 dark:bg-red-400/20 dark:text-red-200"
                    : "shrink-0 rounded-full bg-emerald-200 px-4 py-2 text-sm font-bold tabular-nums text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200"}
                  >
                    {verdict.aiLikelihoodPercent}% AI
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 opacity-85">
                  {verdict.aiGenerated
                    ? pick("这张图片是 AI 生成的。", "This image is AI-generated.")
                    : pick("这张图片不是 AI 生成的。", "This image is not AI-generated.")}
                </p>
              </div>

              <div className="divide-y divide-border rounded-xl border border-border bg-background px-5">
                <ResultMetric
                  label={pick("AI 可能性", "AI likelihood")}
                  value={`${verdict.aiLikelihoodPercent}%`}
                  emphasized
                  danger={verdict.aiGenerated}
                />
                <ResultMetric
                  label={pick("可信度", "Confidence")}
                  value={confidenceLabel}
                />
                <ResultMetric
                  label={pick("判定", "Classification")}
                  value={verdict.aiGenerated
                    ? pick("AI 生成", "AI-generated")
                    : pick("非 AI 生成", "Not AI-generated")}
                  danger={verdict.aiGenerated}
                />
              </div>

              <div className="mt-auto grid gap-3">
                <Button size="lg" onClick={onTryAnother}>
                  <RotateCcw />
                  {pick("换一张图片", "Try another image")}
                </Button>
                <Button size="lg" variant="outline" onClick={onExportReadable} disabled={reportExporting}>
                  {reportExporting ? <LoaderCircle className="animate-spin" /> : <Download />}
                  {reportExporting
                    ? pick("正在生成 PDF", "Creating PDF")
                    : pick("下载 PDF 检测报告", "Download PDF report")}
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  {pick("详细检测信息与未完成项仅保留在下载报告中。", "Detailed findings and incomplete checks are available only in the downloaded report.")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {SHOW_INLINE_TECHNICAL_REPORT ? <div>
      <Card className="overflow-hidden border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 bg-[#101010] p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={summaryClass(summary.kind)}>
                  {summaryCopy.label}
                </Badge>
                <Badge variant="outline">
                  {pick("报告版本", "Report version")} {IMAGE_EVIDENCE_REPORT_VERSION}
                </Badge>
              </div>
              <h2
                className="mt-4 scroll-mt-24 text-2xl font-semibold tracking-tight text-white outline-none"
              >
                {pick("图片来源证据报告", "Image source-evidence report")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {summaryCopy.description}
              </p>
              <div className={`mt-4 rounded-xl border p-4 ${relationshipCopy.className}`}>
                <p className="text-sm font-semibold">{relationshipCopy.label}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {relationshipCopy.description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onExportReadable} disabled={reportExporting}>
                {reportExporting ? <LoaderCircle className="animate-spin" /> : <FileText />}
                {reportExporting
                  ? pick("正在生成 PDF", "Creating PDF")
                  : pick("导出 PDF 摘要", "Export PDF summary")}
              </Button>
              <Button variant="outline" onClick={onExport}>
                <Download />
                {pick("导出 JSON", "Export JSON")}
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-2">
            <ScanSearch className="size-4 text-cyan-300" />
            <h3 className="text-sm font-semibold text-zinc-100">
              {pick("三类证据概览", "Three-channel evidence overview")}
            </h3>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ChannelStatusCard
              label={pick("文件来源", "File provenance")}
              status={channels.provenance}
              version={PROVENANCE_DETECTOR_VERSION}
              finding={
                channels.provenance === "available"
                  ? fileAiSignals.length
                    ? format("发现 {count} 项明确记录", "{count} explicit record(s) found", { count: fileAiSignals.length })
                    : pick("未发现明确 AI 文件记录", "No explicit AI file record")
                  : pick("本次未完成", "Not completed this run")
              }
            />
            <ChannelStatusCard
              label={pick("可见平台标记", "Visible platform marks")}
              status={channels.visibleMark}
              version={VISIBLE_MARK_DETECTOR_VERSION}
              finding={
                channels.visibleMark === "available"
                  ? visibleMark
                    ? format("匹配到 {provider}", "Matched {provider}", { provider: providerLabel(visibleMark.provider) })
                    : pick("未匹配到支持的标记", "No supported mark matched")
                  : pick("本次未完成", "Not completed this run")
              }
            />
            <ChannelStatusCard
              label={pick("像素统计", "Pixel statistics")}
              status={channels.pixel}
              version={pixelModels.length > 1
                ? pick("两级本地像素检测", "Two-stage local pixel check")
                : pick("快速本地像素检测", "Fast local pixel check")}
              finding={
                pixelBand
                  ? getPixelBandCopy(pixelBand, pick).label
                  : pick("本次未完成", "Not completed this run")
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <EvidenceChannelCard
          icon={<FileCheck2 className="size-4 text-emerald-300" />}
          eyebrow={pick("确定文件证据", "Deterministic file evidence")}
          title={pick("元数据与 C2PA", "Metadata and C2PA")}
          badge={pick("可重复读取", "Repeatable")}
        >
          {channels.provenance === "available" && inspection ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Info
                  label={pick("C2PA 凭证", "C2PA credential")}
                  value={inspection.c2pa.present ? pick("已检测到", "Detected") : pick("未检测到", "Not detected")}
                />
                <Info
                  label={pick("签名检查", "Signature check")}
                  value={c2paValidationLabel(inspection, pick)}
                />
                <Info
                  label={pick("来源信任", "Signer trust")}
                  value={c2paTrustLabel(inspection, pick)}
                />
                <Info
                  label={pick("元数据字段", "Metadata fields")}
                  value={`${inspection.metadata.length}`}
                />
              </div>
              {inspection.c2pa.present ? (
                <p className="rounded-lg border border-white/10 bg-white/[.02] px-3 py-2 text-xs leading-5 text-zinc-500">
                  {c2paSummaryLabel(inspection, pick)}
                </p>
              ) : null}
              {fileAiSignals.length ? (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-zinc-500">
                    {pick(
                      "以下记录直接存在于文件中，属于来源或处理历史证据；仍不能据此判断作者身份。",
                      "These records exist directly in the file and document provenance or processing history; they still do not establish authorship.",
                    )}
                  </p>
                  {fileAiSignals.map((signal) => (
                    <SignalRow key={signal.id} signal={signal} />
                  ))}
                </div>
              ) : (
                <EmptyEvidence
                  title={pick(
                    "未发现明确的 AI 文件记录",
                    "No explicit AI file record found",
                  )}
                  description={pick(
                    "字段可能从未存在，也可能已在截图、导出或平台重编码时丢失。",
                    "The fields may never have existed or may have been lost during screenshots, exports, or platform re-encoding.",
                  )}
                />
              )}
              {supportingSignals.length ? (
                <details className="rounded-xl border border-white/10">
                  <summary className="cursor-pointer px-4 py-3 text-sm text-zinc-300">
                    {format(
                      "查看 {count} 项其他文件记录",
                      "View {count} other file record(s)",
                      { count: supportingSignals.length },
                    )}
                  </summary>
                  <div className="space-y-3 border-t border-white/10 p-3">
                    {supportingSignals.map((signal) => (
                      <SignalRow key={signal.id} signal={signal} />
                    ))}
                  </div>
                </details>
              ) : null}
              <RawMetadata inspection={inspection} />
            </div>
          ) : (
            <UnavailableChannel
              text={pick(
                "本次未读取到文件来源通道；其他通道仍可独立查看。",
                "File provenance was unavailable this run; the other channels remain independently readable.",
              )}
            />
          )}
        </EvidenceChannelCard>

        <EvidenceChannelCard
          icon={<Eye className="size-4 text-cyan-300" />}
          eyebrow={pick("视觉线索", "Visual clue")}
          title={pick("可见平台标记", "Visible platform marks")}
          badge={pick("模板匹配", "Template match")}
        >
          {channels.visibleMark === "available" ? (
            visibleMark ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4">
                  <p className="text-sm font-semibold text-zinc-100">
                    {format(
                      "匹配到 {provider} 可见标记",
                      "Matched a visible {provider} mark",
                      { provider: providerLabel(visibleMark.provider) },
                    )}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    {format(
                      "本地模板匹配置信度 {score}%。这是平台处理的视觉线索，不是加密凭证，也不能说明每个像素的来源。",
                      "Local template-match confidence is {score}%. This is a visual clue of platform processing, not a cryptographic credential or proof of every pixel's origin.",
                      { score: Math.round(visibleMark.confidence * 100) },
                    )}
                  </p>
                </div>
                <Info
                  label={pick("当前支持", "Currently supported")}
                  value="Gemini · Doubao · Jimeng"
                />
                {previewUrl && inspection?.width && inspection?.height ? (
                  <ImageRegionPreview
                    src={previewUrl}
                    width={inspection.width}
                    height={inspection.height}
                    region={visibleMark.region}
                    label={pick("匹配位置", "Matched location")}
                    emptyLabel={pick("平台标记位置由检测器内部确认", "The platform-mark location was confirmed internally")}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyEvidence
                title={pick(
                  "未匹配到支持的平台标记",
                  "No supported platform mark matched",
                )}
                description={pick(
                  "图片仍可能来自其他平台、使用不同角标，或在裁剪后失去可见标记。",
                  "The image may still come from another platform, use a different mark, or have lost the mark through cropping.",
                )}
              />
            )
          ) : (
            <UnavailableChannel
              text={pick(
                "本次未完成可见标记检查；这不会影响已读取到的文件证据。",
                "Visible-mark inspection did not finish; this does not affect file evidence already read.",
              )}
            />
          )}
        </EvidenceChannelCard>

        <EvidenceChannelCard
          icon={<BarChart3 className="size-4 text-amber-300" />}
          eyebrow={pick("统计估计", "Statistical estimate")}
          title={pick("像素特征", "Pixel patterns")}
          badge={pick("非来源证明", "Not provenance")}
        >
          {channels.pixel === "available" && pixel ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4">
                <p className="text-xs text-zinc-500">
                  {pick("AI 类像素模式估计", "AI-like pixel-pattern estimate")}
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-100">
                  {getPixelBandCopy(pixelEstimateBand(pixel), pick).label}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {pixelModels.length > 1
                    ? pick(
                        `两级检测综合输出 ${Math.round(pixel.score * 100)}%，不是“图片由 AI 创作的概率”。增强检测会复核不确定或偏低的快速结果；两级明显冲突时仍显示为不确定。`,
                        `Combined two-stage output: ${Math.round(pixel.score * 100)}%. This is not the probability of AI authorship. The enhanced check reviews uncertain or low fast-check results, and clear disagreement remains uncertain.`,
                      )
                    : pick(
                        `快速检测原始输出 ${Math.round(pixel.score * 100)}%，不是“图片由 AI 创作的概率”。结果已结合区域差异与当前推理后端，优先显示保守区间。`,
                        `Fast-check raw output: ${Math.round(pixel.score * 100)}%. This is not the probability of AI authorship. The displayed band also accounts for regional disagreement and the current inference backend.`,
                      )}
                </p>
              </div>
              {pixelModels.length > 1 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pixelModels.map((model, index) => (
                    <div
                      key={`${model.model}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/[.02] p-3"
                    >
                      <p className="text-xs text-zinc-500">
                        {index === 0
                          ? pick("快速检测", "Fast check")
                          : pick("增强检测", "Enhanced check")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-200">
                        {getPixelBandCopy(pixelEstimateBand(model), pick).label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {format("原始输出 {score}%", "Raw output {score}%", {
                          score: Math.round(model.score * 100),
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {pixel.cascade?.secondary === "unavailable" ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.04] px-3 py-2 text-xs leading-5 text-amber-100/80">
                  {pick(
                    "增强检测本次未能运行，已保留快速检测结果，没有补造分数。你可以稍后重试。",
                    "The enhanced check was unavailable this run. The fast-check result was preserved without inventing a score; you can retry later.",
                  )}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Info
                  label={pick("区域一致性", "Region consistency")}
                  value={`${Math.round(pixel.consistency * 100)}%`}
                />
                <Info
                  label={pick("区域差异", "Regional spread")}
                  value={`${Math.round(pixel.spread * 100)} ${pick("个百分点", "points")}`}
                />
              </div>
              <Info label={pick("推理后端", "Backend")} value={pixel.backend} />
              {previewUrl && inspection?.width && inspection.height ? (
                <PixelRegionPreview
                  src={previewUrl}
                  width={inspection.width}
                  height={inspection.height}
                  selectedView={selectedView}
                  label={viewLabel(selectedView, pick)}
                />
              ) : null}
              <details className="rounded-xl border border-white/10">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-300">
                  {format("查看快速检测的 {count} 个区域", "View {count} fast-check region(s)", { count: pixel.views.length })}
                </summary>
                <div className="space-y-3 border-t border-white/10 p-4">
                  {pixel.views.map((view) => (
                    <ViewBar
                      key={view.view}
                      name={viewLabel(view.view, pick)}
                      score={view.score}
                      selected={selectedView === view.view}
                      onSelect={() => setSelectedView(view.view)}
                    />
                  ))}
                </div>
              </details>
              <details className="rounded-xl border border-white/10">
                <summary className="cursor-pointer px-4 py-3 text-xs text-zinc-500">
                  {pick("技术信息", "Technical details")}
                </summary>
                <div className="space-y-2 border-t border-white/10 p-4">
                  {pixelModels.map((model, index) => (
                    <p key={`${model.model}-technical-${index}`} className="break-all font-mono text-[11px] text-zinc-600">
                      {model.model} · {model.backend}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          ) : (
            <UnavailableChannel
              text={pick(
                "本次未完成像素统计。报告不会使用虚构分数补齐该通道。",
                "Pixel statistics did not finish. The report does not invent a score for this channel.",
              )}
            />
          )}
        </EvidenceChannelCard>
      </div>

      <Card className="border-white/10 bg-[#0d0d0d]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldQuestion className="size-4 text-cyan-300" />
            {pick("报告限制", "Report limitations")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-sm leading-6 text-zinc-500 md:grid-cols-2">
            {REPORT_LIMITATIONS.map((item) => (
              <li key={item.en} className="flex gap-2">
                <CircleHelp className="mt-1 size-4 shrink-0 text-zinc-600" />
                <span>{pick(item.zh, item.en)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      </div> : null}
    </div>
  )
}

function EvidenceChannelCard({
  icon,
  eyebrow,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  badge: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-white/10 bg-[#0d0d0d]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-zinc-500">
            {icon}
            {eyebrow}
          </p>
          <Badge variant="outline">{badge}</Badge>
        </div>
        <CardTitle className="pt-2 text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ChannelStatusCard({
  label,
  status,
  version,
  finding,
}: {
  label: string
  status: DetectionChannelStatus
  version: string
  finding: string
}) {
  const { pick } = useLanguage()
  const available = status === "available"
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <Badge
          className={
            available
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-white/10 text-zinc-400"
          }
        >
          {available
            ? pick("可用", "Available")
            : status === "unavailable"
              ? pick("本次不可用", "Unavailable")
              : pick("未运行", "Not run")}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-5 text-zinc-300">{finding}</p>
      <p className="mt-2 break-all font-mono text-[10px] text-zinc-600">
        {version}
      </p>
    </div>
  )
}

function EmptyEvidence({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <CheckCircle2 className="size-4 text-zinc-500" />
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
    </div>
  )
}

function UnavailableChannel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[.015] p-4">
      <p className="flex items-start gap-2 text-sm leading-6 text-zinc-500">
        <AlertTriangle className="mt-1 size-4 shrink-0 text-amber-300" />
        {text}
      </p>
    </div>
  )
}

function RawMetadata({ inspection }: { inspection: ImageInspection }) {
  const { pick, format } = useLanguage()
  if (!inspection.metadata.length) return null
  return (
    <details className="rounded-xl border border-white/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-300">
        {format("查看 {count} 个原始字段", "View {count} raw fields", {
          count: inspection.metadata.length,
        })}
      </summary>
      <div className="max-h-80 overflow-auto border-t border-white/10">
        <table className="w-full text-left text-xs">
          <tbody>
            {inspection.metadata.map((item) => (
              <tr
                key={`${item.key}-${item.value}`}
                className="border-b border-white/5 last:border-0"
              >
                <th className="w-1/3 px-4 py-2 font-medium text-zinc-400">
                  {item.key}
                </th>
                <td className="break-all px-4 py-2 text-zinc-500">
                  {item.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sr-only">{pick("原始元数据", "Raw metadata")}</p>
    </details>
  )
}

function ResultMetric({
  label,
  value,
  emphasized = false,
  danger = false,
}: {
  label: string
  value: string
  emphasized?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          danger
            ? "text-red-600 dark:text-red-300"
            : emphasized
              ? "text-cyan-700 dark:text-cyan-300"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function ViewBar({
  name,
  score,
  selected,
  onSelect,
}: {
  name: string
  score: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`block w-full rounded-lg p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selected ? "bg-cyan-300/[.07]" : "hover:bg-white/[.03]"}`}
    >
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-400">{name}</span>
        <span className="font-mono text-zinc-300">
          {Math.round(score * 100)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full rounded-full bg-amber-300"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
    </button>
  )
}

function PixelRegionPreview({
  src,
  width,
  height,
  selectedView,
  label,
}: {
  src: string
  width: number
  height: number
  selectedView: string
  label: string
}) {
  const plan = buildImageViewPlan(width, height)
  const selected = plan.find((item) => item.name === selectedView) ?? plan[0]
  const bounds = selected?.bounds
  const region = bounds
    ? {
        x: bounds[0],
        y: bounds[1],
        width: bounds[2] - bounds[0] + 1,
        height: bounds[3] - bounds[1] + 1,
      }
    : null
  return (
    <ImageRegionPreview
      src={src}
      width={width}
      height={height}
      region={region}
      label={label}
      emptyLabel={label}
    />
  )
}

function ImageRegionPreview({
  src,
  width,
  height,
  region,
  label,
  emptyLabel,
}: {
  src: string
  width: number
  height: number
  region: { x: number; y: number; width: number; height: number } | null
  label: string
  emptyLabel: string
}) {
  const overlay = region
    ? {
        left: `${Math.max(0, Math.min(100, region.x / width * 100))}%`,
        top: `${Math.max(0, Math.min(100, region.y / height * 100))}%`,
        width: `${Math.max(0, Math.min(100, region.width / width * 100))}%`,
        height: `${Math.max(0, Math.min(100, region.height / height * 100))}%`,
      }
    : null
  return (
    <figure className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div
        className="relative mx-auto max-h-56 w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <Image src={src} alt="" fill unoptimized className="object-cover" />
        {overlay ? (
          <span
            aria-hidden="true"
            className="absolute rounded border-2 border-cyan-300 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(0,0,0,.55)]"
            style={overlay}
          />
        ) : null}
      </div>
      <figcaption className="mt-2 text-center text-xs text-zinc-500">
        {overlay ? label : emptyLabel}
      </figcaption>
    </figure>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.02] p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-zinc-200">
        {value}
      </p>
    </div>
  )
}

function SignalRow({ signal }: { signal: ImageSignal }) {
  const { pick } = useLanguage()
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          {signal.group === "c2pa" ? (
            <Fingerprint className="size-4 text-cyan-300" />
          ) : (
            <FileSearch className="size-4 text-zinc-500" />
          )}
          {localizedImageSignalLabel(signal, pick)}
        </p>
        <p className="mt-1 break-all text-xs text-zinc-500">{signal.value}</p>
      </div>
      <Badge variant={signal.severity === "high" ? "destructive" : "secondary"}>
        {signal.severity === "high"
          ? pick("明确记录", "Explicit")
          : signal.severity === "medium"
            ? pick("相关记录", "Related")
            : pick("文件信息", "File info")}
      </Badge>
    </div>
  )
}

function getSummaryCopy(
  kind: EvidenceSummaryKind,
  pick: (zh: string, en: string) => string,
) {
  if (kind === "file-evidence") {
    return {
      label: pick("发现文件来源记录", "File evidence found"),
      description: pick(
        "文件中存在与 AI 生成器或工作流相关的可重复读取记录。请结合下方 C2PA、元数据内容和其他通道理解处理历史。",
        "The file contains repeatable records associated with an AI generator or workflow. Review the C2PA, metadata, and other channels below to understand its processing history.",
      ),
    }
  }
  if (kind === "visual-clue") {
    return {
      label: pick("发现视觉线索", "Visual clue found"),
      description: pick(
        "检测到支持平台的可见标记，但文件中没有更强的 AI 来源记录。该标记说明平台处理痕迹，不是作者身份或整图来源证明。",
        "A supported visible platform mark was detected, without stronger AI provenance in the file. It indicates platform processing, not authorship or proof of the whole image's origin.",
      ),
    }
  }
  if (kind === "statistical-estimate") {
    return {
      label: pick("仅有统计估计", "Statistical estimate only"),
      description: pick(
        "当前报告只有像素模型估计，没有确定的 AI 文件记录或支持的平台标记。请不要把分数当作图片来源概率。",
        "This report only has a pixel-model estimate, with no deterministic AI file record or supported platform mark. Do not treat the score as a probability of origin.",
      ),
    }
  }
  return {
    label: pick("证据不足", "Insufficient evidence"),
    description: pick(
      "当前通道没有提供足够证据确认图片来源。没有检测到证据不等于图片一定由真人创作。",
      "The available channels do not provide enough evidence to establish the image's origin. No detected evidence does not prove human authorship.",
    ),
  }
}

function getRelationshipCopy(
  relationship: FusedImageDetection["evidenceAgreement"],
  pick: (zh: string, en: string) => string,
) {
  if (relationship === "agree") {
    return {
      label: pick("多类证据方向一致", "Evidence channels point in the same direction"),
      description: pick(
        "文件或平台记录与像素统计形成同向结果。仍应结合原始文件和使用场景复核。",
        "File or platform records align with the pixel estimate. Review the original file and context before acting on it.",
      ),
      className: "border-emerald-300/20 bg-emerald-300/[.04] text-emerald-100",
    }
  }
  if (relationship === "conflict") {
    return {
      label: pick("检测证据存在冲突", "Detection evidence conflicts"),
      description: pick(
        "优先查看可重复读取的文件记录或可见平台标记；像素统计不能覆盖这些证据，也不应被强行调高。",
        "Prioritize repeatable file records or visible platform marks. Pixel statistics cannot override them and should not be forced upward.",
      ),
      className: "border-amber-300/25 bg-amber-300/[.05] text-amber-100",
    }
  }
  if (relationship === "provenance-only") {
    return {
      label: pick("来源或平台证据独立成立", "Provenance or platform evidence stands alone"),
      description: pick(
        "像素通道没有形成同向结论，但不影响已经读取到的来源或平台处理记录。",
        "The pixel channel did not form a matching result, but that does not invalidate the provenance or platform record already found.",
      ),
      className: "border-cyan-300/20 bg-cyan-300/[.04] text-cyan-100",
    }
  }
  if (relationship === "pixel-only") {
    return {
      label: pick("只有像素模型形成明显方向", "Only the pixel model has a clear direction"),
      description: pick(
        "没有文件来源或支持的平台标记作为佐证，结论强度有限，建议保留为线索。",
        "No file provenance or supported platform mark corroborates it, so treat this as a limited clue.",
      ),
      className: "border-amber-300/20 bg-amber-300/[.04] text-amber-100",
    }
  }
  return {
    label: pick("当前证据不足", "Current evidence is insufficient"),
    description: pick(
      "三个通道没有形成可确认来源的组合证据。未检测到信号不等于真人创作。",
      "The channels did not form enough combined evidence to establish origin. No detected signal does not prove human authorship.",
    ),
    className: "border-white/10 bg-white/[.02] text-zinc-200",
  }
}

function getPixelBandCopy(
  band: ReturnType<typeof pixelEstimateBand>,
  pick: (zh: string, en: string) => string,
) {
  if (band === "higher") return { label: pick("较高的 AI 类像素信号", "Higher AI-like pixel signals") }
  if (band === "lower") return { label: pick("较低的 AI 类像素信号", "Lower AI-like pixel signals") }
  return { label: pick("未形成 AI 共识", "No AI consensus") }
}

function c2paValidationLabel(
  inspection: ImageInspection,
  pick: (zh: string, en: string) => string,
) {
  if (!inspection.c2pa.present) return pick("不适用", "Not applicable")
  if (inspection.c2pa.validated === true) return pick("检查通过", "Passed")
  if (inspection.c2pa.validated === false) return pick("存在警告", "Warnings found")
  return pick("未完整验证", "Not fully verified")
}

function c2paTrustLabel(
  inspection: ImageInspection,
  pick: (zh: string, en: string) => string,
) {
  if (!inspection.c2pa.present) return pick("不适用", "Not applicable")
  if (inspection.c2pa.trust === "trusted") return pick("当前信任列表认可", "Trusted by current list")
  if (inspection.c2pa.trust === "untrusted") return pick("未受当前信任列表认可", "Not trusted by current list")
  return pick("未建立信任结论", "No trust conclusion")
}

function c2paSummaryLabel(
  inspection: ImageInspection,
  pick: (zh: string, en: string) => string,
) {
  if (inspection.c2pa.validationState === "trusted") {
    return pick(
      "C2PA 清单有效，签名来源受当前信任列表认可。",
      "The C2PA manifest is valid and its signer is recognized by the current trust list.",
    )
  }
  if (inspection.c2pa.validationState === "valid") {
    return pick(
      "C2PA 清单通过结构与签名检查，但未建立来源信任结论。",
      "The C2PA manifest passed structural and signature checks, but no signer-trust conclusion was established.",
    )
  }
  if (inspection.c2pa.validationState === "invalid") {
    return pick(
      "读取到 C2PA，但存在验证失败或警告。",
      "A C2PA manifest was read, but validation failures or warnings were reported.",
    )
  }
  return pick(
    "C2PA 清单可读取，但当前 SDK 未提供完整验证状态。",
    "The C2PA manifest is readable, but the current SDK did not provide a complete validation state.",
  )
}

function summaryClass(kind: EvidenceSummaryKind) {
  if (kind === "file-evidence") return "bg-emerald-500/15 text-emerald-300"
  if (kind === "visual-clue") return "bg-cyan-500/15 text-cyan-300"
  if (kind === "statistical-estimate") return "bg-amber-500/15 text-amber-300"
  return "bg-white/10 text-zinc-300"
}

function readableSummaryKind(kind: EvidenceSummaryKind, zh: boolean) {
  const labels: Record<EvidenceSummaryKind, [string, string]> = {
    "file-evidence": ["发现文件来源记录", "File provenance found"],
    "visual-clue": ["发现可见平台线索", "Visible platform clue found"],
    "statistical-estimate": ["仅有像素统计估计", "Pixel estimate only"],
    insufficient: ["证据不足", "Insufficient evidence"],
  }
  return labels[kind][zh ? 0 : 1]
}

function readableRelationship(
  relationship: FusedImageDetection["evidenceAgreement"],
  zh: boolean,
) {
  const labels: Record<FusedImageDetection["evidenceAgreement"], [string, string]> = {
    agree: ["多类证据方向一致", "Evidence channels agree"],
    conflict: ["检测证据存在冲突", "Detection evidence conflicts"],
    "pixel-only": ["只有像素模型形成明显方向", "Only the pixel model has a clear direction"],
    "provenance-only": ["来源或平台证据独立成立", "Provenance or platform evidence stands alone"],
    insufficient: ["当前证据不足", "Current evidence is insufficient"],
  }
  return labels[relationship][zh ? 0 : 1]
}

function readableReliability(
  reliability: FusedImageDetection["reliability"],
  zh: boolean,
) {
  const labels: Record<FusedImageDetection["reliability"], [string, string]> = {
    high: ["高", "High"],
    medium: ["中", "Medium"],
    low: ["有限", "Limited"],
  }
  return labels[reliability][zh ? 0 : 1]
}

function readableVerdict(
  classification: SimpleImageClassification,
  zh: boolean,
) {
  const labels = {
    "ai-generated": ["AI 生成", "AI-generated"],
    "not-ai-generated": ["非 AI 生成", "Not AI-generated"],
  } as const
  return labels[classification][zh ? 0 : 1]
}

function readableChannelStatus(status: DetectionChannelStatus, zh: boolean) {
  const labels: Record<DetectionChannelStatus, [string, string]> = {
    available: ["可用", "Available"],
    unavailable: ["本次不可用", "Unavailable this run"],
    "not-run": ["未运行", "Not run"],
  }
  return labels[status][zh ? 0 : 1]
}

function readablePixelBand(
  band: ReturnType<typeof pixelEstimateBand>,
  zh: boolean,
) {
  const labels = {
    higher: ["较高的 AI 类像素信号", "Higher AI-like pixel signals"],
    uncertain: ["未形成 AI 共识", "No AI consensus"],
    lower: ["较低的 AI 类像素信号", "Lower AI-like pixel signals"],
  } as const
  return labels[band][zh ? 0 : 1]
}

function providerLabel(provider: VisibleAiMarkDetection["provider"]) {
  return { gemini: "Gemini", doubao: "Doubao", jimeng: "Jimeng" }[provider]
}

function viewLabel(value: string, pick: (zh: string, en: string) => string) {
  const labels: Record<string, string> = {
    full: pick("整张图片", "Full image"),
    center: pick("中心区域", "Center"),
    "top-left": pick("左上区域", "Top left"),
    "top-right": pick("右上区域", "Top right"),
    "bottom-left": pick("左下区域", "Bottom left"),
    "bottom-right": pick("右下区域", "Bottom right"),
  }
  return labels[value] || value
}
