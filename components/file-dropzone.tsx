"use client"

import { FileImage, LoaderCircle, UploadCloud, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { validateImageFile } from "@/lib/file-validation"

export function FileDropzone({
  file,
  onFile,
  accept = "image/jpeg,image/png,image/webp",
  maxBytes = 25 * 1024 * 1024,
  disabled,
}: {
  file: File | null
  onFile: (file: File | null) => void
  accept?: string
  maxBytes?: number
  disabled?: boolean
}) {
  const { language, pick } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")
  const [validating, setValidating] = useState(false)

  const select = useCallback(async (next?: File) => {
    setError("")
    if (!next) return
    if (next.size > maxBytes) {
      setError(pick(`文件不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`, `File cannot exceed ${Math.round(maxBytes / 1024 / 1024)}MB`))
      return
    }
    const allowed = !next.type || accept.split(",").some((type) => type === next.type || (type.endsWith("/*") && next.type.startsWith(type.slice(0, -1))))
    if (!allowed) {
      setError(pick("暂不支持这个文件格式", "This file format is not supported"))
      return
    }
    setValidating(true)
    try {
      await validateImageFile(next)
      onFile(next)
    } catch (reason) {
      setError(reason instanceof Error ? translateValidationError(reason.message, language) : pick("图片校验失败", "Image validation failed"))
    } finally {
      setValidating(false)
    }
  }, [accept, language, maxBytes, onFile, pick])

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
      <button
        type="button"
        disabled={disabled || validating}
        onClick={() => inputRef.current?.click()}
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
      </button>
      <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(event) => select(event.target.files?.[0])} />
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function translateValidationError(message: string, language: "zh-CN" | "en") {
  if (language !== "en") return message
  if (message.includes("像素不能超过")) return message.replace("图片像素不能超过", "Image pixels cannot exceed ")
  if (message.includes("文件内容不是受支持")) return "File contents are not a supported JPG, PNG, or WebP image"
  if (message.includes("文件扩展信息与实际")) return "The declared file type does not match the detected image contents"
  if (message.includes("浏览器无法解码")) return "The browser cannot decode this image; the file may be damaged"
  return "Image validation failed"
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
