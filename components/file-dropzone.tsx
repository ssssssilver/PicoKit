"use client"

import { FileImage, LoaderCircle, UploadCloud, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { validateImageFile } from "@/lib/file-validation"

export function FileDropzone({
  file,
  onFile,
  accept = "image/jpeg,image/png,image/webp",
  maxBytes = 25 * 1024 * 1024,
  maxPixels = 64_000_000,
  disabled,
}: {
  file: File | null
  onFile: (file: File | null) => void
  accept?: string
  maxBytes?: number
  maxPixels?: number
  disabled?: boolean
}) {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")
  const [choosing, setChoosing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [validationHint, setValidationHint] = useState<"reading" | "decoding" | "slow">("reading")

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const handleCancel = () => setChoosing(false)
    input.addEventListener("cancel", handleCancel)
    return () => input.removeEventListener("cancel", handleCancel)
  }, [])

  const select = useCallback(async (next?: File) => {
    setError("")
    if (!next) return
    if (next.size > maxBytes) {
      setError(format("文件不能超过 {size}MB", "File cannot exceed {size}MB", { size: Math.round(maxBytes / 1024 / 1024) }))
      return
    }
    setPendingFile(next)
    setValidationHint("reading")
    setValidating(true)
    const decodingTimer = window.setTimeout(() => setValidationHint("decoding"), 350)
    const slowTimer = window.setTimeout(() => setValidationHint("slow"), 1_800)
    try {
      const validated = await validateImageFile(next, maxPixels)
      const allowed = accept.split(",").map((type) => type.trim().toLowerCase()).some((type) =>
        type === validated.mime || (type.endsWith("/*") && validated.mime.startsWith(type.slice(0, -1))),
      )
      if (!allowed) {
        setError(pick("暂不支持这个文件格式", "This file format is not supported"))
        return
      }
      onFile(validated.file)
    } catch (reason) {
      setError(reason instanceof Error ? translateValidationError(reason.message, pick, format) : pick("图片校验失败", "Image validation failed"))
    } finally {
      window.clearTimeout(decodingTimer)
      window.clearTimeout(slowTimer)
      setValidating(false)
      setPendingFile(null)
      setValidationHint("reading")
    }
  }, [accept, format, maxBytes, maxPixels, onFile, pick])

  function openFilePicker() {
    const input = inputRef.current
    if (!input) return
    setError("")
    setChoosing(true)
    input.value = ""
    window.addEventListener("focus", () => {
      window.setTimeout(() => {
        if (!input.files?.length) setChoosing(false)
      }, 5_000)
    }, { once: true })
    input.click()
  }

  const choosingStatus = choosing && !validating ? (
    <div role="status" aria-live="polite" className="rounded-xl border border-cyan-300/25 bg-cyan-300/[.045] p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] text-cyan-300">
          <LoaderCircle className="size-6 animate-spin" />
        </span>
        <div>
          <p className="text-sm font-medium text-zinc-100">{pick("正在等待图片选择", "Waiting for image selection")}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{pick(
            "选择完成后会立即读取并验证图片，请勿重复点击。",
            "The image will be read and validated immediately after selection. There is no need to click again.",
          )}</p>
        </div>
      </div>
    </div>
  ) : null

  if (validating && pendingFile) {
    const hint = validationHint === "slow"
      ? pick("图片较大，解码可能需要几秒，请保持页面打开", "This is a large image. Decoding may take a few seconds; keep this page open")
      : validationHint === "decoding"
        ? pick("正在解析图片尺寸和像素", "Checking image dimensions and pixels")
        : pick("正在读取并验证图片", "Reading and validating the image")
    return (
      <div role="status" aria-live="polite" className="rounded-xl border border-cyan-300/25 bg-cyan-300/[.045] p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <span className="relative grid size-12 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] text-cyan-300">
            <FileImage />
            <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border border-cyan-300/30 bg-[#111]">
              <LoaderCircle className="size-3.5 animate-spin" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{pendingFile.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{formatBytes(pendingFile.size)} · {hint}</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-300/80" />
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">{pick(
          "验证完成后会立即显示文件，并允许开始本地处理。",
          "The file will appear as soon as validation finishes, then local processing can begin.",
        )}</p>
      </div>
    )
  }

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[.025] p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#161616] text-cyan-300"><FileImage /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">{file.name}</p>
          <p className="mt-1 text-xs text-zinc-500">{formatBytes(file.size)} · {file.type || pick("未知格式", "Unknown format")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onFile(null)} disabled={disabled} aria-label={pick("移除文件", "Remove file")}><X /></Button>
      </div>
    )
  }

  return (
    <div>
      {choosingStatus ?? <button
        type="button"
        disabled={disabled || validating}
        onClick={openFilePicker}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          select(event.dataTransfer.files[0])
        }}
        className={cn(
          "group flex min-h-72 w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#0f0f0f] px-6 text-center transition hover:border-cyan-300/60 hover:bg-white/[.025] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60",
          dragging && "border-cyan-300 bg-cyan-300/[.04]",
        )}
      >
        <span className="grid size-14 place-items-center text-zinc-200 transition group-hover:-translate-y-1 group-hover:text-cyan-300">{validating ? <LoaderCircle className="size-8 animate-spin" /> : <UploadCloud className="size-8" />}</span>
        <span className="mt-4 text-base font-semibold text-zinc-100">{validating ? pick("正在检查文件内容", "Checking file contents") : pick("拖入图片，或点击选择", "Drop an image, or click to choose")}</span>
        <span className="mt-2 font-mono text-xs text-zinc-500">JPG, PNG, WebP · {pick("最大", "Up to")} {Math.round(maxBytes / 1024 / 1024)}MB</span>
      </button>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const next = event.currentTarget.files?.[0]
          setChoosing(false)
          void select(next)
        }}
      />
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function translateValidationError(
  message: string,
  pick: (zh: string, en: string) => string,
  format: (zh: string, en: string, values: Record<string, string | number>) => string,
) {
  if (message.includes("像素不能超过")) {
    const limit = message.match(/[\d,.]+\s*MP/i)?.[0] ?? message.match(/[\d,.]+/)?.[0] ?? ""
    return format("图片像素不能超过 {limit}", "Image pixels cannot exceed {limit}", { limit })
  }
  if (message.includes("文件内容不是受支持")) return pick("文件内容不是受支持的 JPG、PNG 或 WebP 图片", "File contents are not a supported JPG, PNG, or WebP image")
  if (message.includes("浏览器无法解码")) return pick("浏览器无法解码此图片，文件可能已损坏", "The browser cannot decode this image; the file may be damaged")
  return pick("图片校验失败", "Image validation failed")
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
