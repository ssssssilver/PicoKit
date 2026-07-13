import type { C2paInspection, ImageInspection, ImageSignal, MetadataEntry } from "@/lib/image-types"

const AI_PATTERNS: Array<{ pattern: RegExp; label: string; severity: "high" | "medium" }> = [
  { pattern: /trainedalgorithmicmedia/i, label: "IPTC：AI 生成内容", severity: "high" },
  { pattern: /compositewithtrainedalgorithmicmedia/i, label: "IPTC：包含 AI 生成内容", severity: "high" },
  { pattern: /stable\s*diffusion|automatic1111|comfyui|fooocus/i, label: "Stable Diffusion 工作流", severity: "high" },
  { pattern: /midjourney/i, label: "Midjourney 来源字段", severity: "high" },
  { pattern: /dall[·\- ]?e|openai image|gpt-image/i, label: "OpenAI 图片来源字段", severity: "high" },
  { pattern: /adobe\s*firefly|generative fill/i, label: "Adobe 生成式编辑字段", severity: "high" },
  { pattern: /google\s*(gemini|imagen)|gemini/i, label: "Google AI 来源字段", severity: "medium" },
  { pattern: /negative\s*prompt|sampler|cfg\s*scale|seed\s*[:=]|workflow/i, label: "生成参数或工作流", severity: "medium" },
  { pattern: /made\s+with\s+ai|ai[- ]generated|generated\s+by\s+ai/i, label: "Made with AI 标签信号", severity: "high" },
]

const C2PA_PATTERN = /c2pa|jumbf|content credentials|dcterms:provenance|c2pa\.manifest/i

function formatValue(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ")
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value)
      return json.length > 500 ? `${json.slice(0, 500)}…` : json
    } catch {
      return String(value)
    }
  }
  const text = String(value)
  return text.length > 500 ? `${text.slice(0, 500)}…` : text
}

function flattenMetadata(input: unknown, prefix = "", output: MetadataEntry[] = []): MetadataEntry[] {
  if (!input || typeof input !== "object" || output.length > 120) return output
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
      flattenMetadata(value, path, output)
    } else {
      const formatted = formatValue(value)
      if (formatted) output.push({ key: path, value: formatted })
    }
  }
  return output
}

function decodeSearchText(bytes: Uint8Array) {
  try {
    return new TextDecoder("latin1").decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

function detectFormat(bytes: Uint8Array, fallback: string) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { format: "JPEG", mime: "image/jpeg" }
  if (bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG") return { format: "PNG", mime: "image/png" }
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { format: "WebP", mime: "image/webp" }
  return { format: fallback.split("/")[1]?.toUpperCase() || "未知", mime: fallback || "application/octet-stream" }
}

async function readDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    return {}
  }
}

function makeSignals(searchText: string, metadata: MetadataEntry[], hasC2paBytes: boolean): ImageSignal[] {
  const combined = `${searchText}\n${metadata.map((item) => `${item.key}:${item.value}`).join("\n")}`
  const signals: ImageSignal[] = []

  if (hasC2paBytes) {
    signals.push({ id: "c2pa-container", label: "检测到 C2PA/JUMBF 容器", value: "文件包含 Content Credentials 相关字节", group: "c2pa", severity: "high" })
  }

  for (const [index, item] of AI_PATTERNS.entries()) {
    const match = combined.match(item.pattern)
    if (match) {
      signals.push({ id: `ai-${index}`, label: item.label, value: match[0], group: "ai", severity: item.severity })
    }
  }

  const software = metadata.find((item) => /(^|\.)(software|creatorTool|generator)$/i.test(item.key))
  if (software) signals.push({ id: "software", label: "写入软件", value: software.value, group: "software", severity: "info" })
  const camera = metadata.find((item) => /(^|\.)(make|model)$/i.test(item.key))
  if (camera) signals.push({ id: "camera", label: "相机信息", value: camera.value, group: "camera", severity: "info" })

  return signals.filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index)
}

async function inspectC2pa(file: File, likelyPresent: boolean): Promise<C2paInspection> {
  if (!likelyPresent) return { present: false, validated: null, summary: "未发现 C2PA 容器信号" }
  try {
    const { createC2pa } = await import("@contentauth/c2pa-web")
    const c2pa = await createC2pa({ wasmSrc: "/c2pa.wasm" })
    const reader = await c2pa.reader.fromBlob(file.type || "application/octet-stream", file)
    if (!reader) return { present: true, validated: null, summary: "检测到 C2PA 字节，但 SDK 未返回可读取的清单" }
    try {
      const manifest = await reader.manifestStore()
      const serialized = JSON.stringify(manifest)
      const failed = /invalid|failure|mismatch|untrusted/i.test(serialized)
      return {
        present: true,
        validated: !failed,
        summary: failed ? "读取到 C2PA，但存在验证警告" : "C2PA 清单可读取",
        manifest,
      }
    } finally {
      await reader.free()
    }
  } catch (error) {
    return {
      present: true,
      validated: null,
      summary: `检测到 C2PA 字节，但清单无法完整验证：${error instanceof Error ? error.message : "未知错误"}`,
    }
  }
}

export async function inspectImage(file: File): Promise<ImageInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { format, mime } = detectFormat(bytes, file.type)
  const searchText = decodeSearchText(bytes)
  const hasC2paBytes = C2PA_PATTERN.test(searchText)
  const dimensions = await readDimensions(file)

  let metadata: MetadataEntry[] = []
  try {
    const exifr = await import("exifr")
    const parsed = await exifr.parse(file, true)
    metadata = flattenMetadata(parsed)
  } catch {
    metadata = []
  }

  const signals = makeSignals(searchText, metadata, hasC2paBytes)
  const c2pa = await inspectC2pa(file, hasC2paBytes)
  const highSignals = signals.filter((signal) => signal.severity === "high")

  return {
    fileName: file.name,
    mime,
    format,
    bytes: file.size,
    ...dimensions,
    metadata,
    signals,
    c2pa,
    risk: highSignals.length ? "signals-found" : signals.length || metadata.length ? "no-signals" : "unknown",
    note: highSignals.length
      ? "发现与 AI 来源或内容凭证相关的文件信号。这些信号可以说明处理历史，但不能单独证明作者身份。"
      : "未发现明确 AI 来源信号不等于图片一定由真人创作；平台也可能使用不可见水印或像素分类器。",
  }
}
