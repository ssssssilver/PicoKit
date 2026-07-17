import type { TransformOptions } from "@/lib/image-transformer"

export type BatchOutputFormat = TransformOptions["format"]

export type BatchTransformSettings = {
  format: BatchOutputFormat
  quality: number
  maxEdge?: number
  targetKb?: number
  nameTemplate: string
}

export type SequentialBatchResult<T, R> =
  | { item: T; index: number; status: "fulfilled"; value: R }
  | { item: T; index: number; status: "rejected"; reason: unknown }

export type SequentialBatchHooks<T, R> = {
  shouldStop?: () => boolean
  onStart?: (item: T, index: number) => void
  onSettled?: (result: SequentialBatchResult<T, R>) => void
}

const extensions: Record<BatchOutputFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function batchOutputExtension(format: BatchOutputFormat) {
  return extensions[format]
}

export function sourceImageStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").trim()
  return sanitizeFileStem(stem || "image")
}

export function buildBatchOutputName(
  sourceName: string,
  index: number,
  format: BatchOutputFormat,
  template = "{name}-ready-{index}",
) {
  const extension = batchOutputExtension(format)
  const position = String(Math.max(0, index) + 1).padStart(2, "0")
  const sourceStem = sourceImageStem(sourceName)
  const requested = (template.trim() || "{name}-ready-{index}")
    .replaceAll("{name}", sourceStem)
    .replaceAll("{index}", position)
    .replaceAll("{ext}", extension)
  const withNoDuplicateExtension = requested.replace(new RegExp(`\\.${extension}$`, "i"), "")
  const stem = sanitizeFileStem(withNoDuplicateExtension) || `${sourceStem}-ready-${position}`
  return `${stem}.${extension}`
}

export function makeUniqueBatchName(requestedName: string, usedNames: Set<string>) {
  const normalized = requestedName.toLocaleLowerCase()
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized)
    return requestedName
  }

  const dot = requestedName.lastIndexOf(".")
  const stem = dot > 0 ? requestedName.slice(0, dot) : requestedName
  const extension = dot > 0 ? requestedName.slice(dot) : ""
  let copy = 2
  let candidate = `${stem}-${copy}${extension}`
  while (usedNames.has(candidate.toLocaleLowerCase())) {
    copy += 1
    candidate = `${stem}-${copy}${extension}`
  }
  usedNames.add(candidate.toLocaleLowerCase())
  return candidate
}

export function buildBatchOutputNames(
  sourceNames: readonly string[],
  settings: Pick<BatchTransformSettings, "format" | "nameTemplate">,
) {
  const used = new Set<string>()
  return sourceNames.map((sourceName, index) => makeUniqueBatchName(
    buildBatchOutputName(sourceName, index, settings.format, settings.nameTemplate),
    used,
  ))
}

export function toBatchTransformOptions(settings: BatchTransformSettings): TransformOptions {
  const maxEdge = Number.isFinite(settings.maxEdge) && Number(settings.maxEdge) > 0
    ? Math.max(320, Math.min(12_000, Math.round(Number(settings.maxEdge))))
    : undefined
  const requestedQuality = Number(settings.quality)
  const quality = Number.isFinite(requestedQuality)
    ? Math.max(0.2, Math.min(1, requestedQuality / 100))
    : 0.82
  const targetBytes = settings.format !== "image/png" && Number.isFinite(settings.targetKb) && Number(settings.targetKb) > 0
    ? Math.max(10, Math.min(10_000, Math.round(Number(settings.targetKb)))) * 1024
    : undefined

  return {
    format: settings.format,
    quality,
    maxEdge,
    aspect: "original",
    targetBytes,
  }
}

export async function runSequentialBatch<T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
  hooks: SequentialBatchHooks<T, R> = {},
) {
  const results: SequentialBatchResult<T, R>[] = []
  for (let index = 0; index < items.length; index += 1) {
    if (hooks.shouldStop?.()) break
    const item = items[index]
    hooks.onStart?.(item, index)
    let result: SequentialBatchResult<T, R>
    try {
      result = { item, index, status: "fulfilled", value: await task(item, index) }
    } catch (reason) {
      result = { item, index, status: "rejected", reason }
    }
    results.push(result)
    hooks.onSettled?.(result)
  }
  return results
}

function sanitizeFileStem(value: string) {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/^[-. ]+/g, "")
    .trim()
    .slice(0, 160)
  if (!normalized) return "image"
  return WINDOWS_RESERVED_NAME.test(normalized) ? `_${normalized}` : normalized
}
