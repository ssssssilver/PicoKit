"use client"

import { FileImage, LoaderCircle, UploadCloud, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")
  const [validating, setValidating] = useState(false)

  const select = useCallback(async (next?: File) => {
    setError("")
    if (!next) return
    if (next.size > maxBytes) {
      setError(`文件不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`)
      return
    }
    const allowed = !next.type || accept.split(",").some((type) => type === next.type || (type.endsWith("/*") && next.type.startsWith(type.slice(0, -1))))
    if (!allowed) {
      setError("暂不支持这个文件格式")
      return
    }
    setValidating(true)
    try {
      await validateImageFile(next)
      onFile(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "图片校验失败")
    } finally {
      setValidating(false)
    }
  }, [accept, maxBytes, onFile])

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-cyan-700 shadow-sm"><FileImage /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
          <p className="mt-1 text-xs text-slate-500">{formatBytes(file.size)} · {file.type || "未知格式"}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onFile(null)} disabled={disabled} aria-label="移除文件"><X /></Button>
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
          "group flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 text-center transition hover:border-cyan-400 hover:bg-cyan-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60",
          dragging && "border-cyan-500 bg-cyan-50",
        )}
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-950/10 transition group-hover:-translate-y-1">{validating ? <LoaderCircle className="size-7 animate-spin" /> : <UploadCloud className="size-7" />}</span>
        <span className="mt-5 text-base font-semibold text-slate-950">{validating ? "正在检查文件内容" : "拖入图片，或点击选择"}</span>
        <span className="mt-2 text-sm text-slate-500">JPG、PNG、WebP · 最大 {Math.round(maxBytes / 1024 / 1024)}MB</span>
      </button>
      <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(event) => select(event.target.files?.[0])} />
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
