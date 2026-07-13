import type { SanitizeMode, SanitizeResult } from "@/lib/image-types"

const AI_TEXT = /trainedalgorithmicmedia|compositewithtrainedalgorithmicmedia|stable\s*diffusion|automatic1111|comfyui|fooocus|midjourney|dall[·\- ]?e|openai image|gpt-image|firefly|gemini|imagen|negative\s*prompt|cfg\s*scale|made\s+with\s+ai|ai[- ]generated/i
const C2PA_TEXT = /c2pa|jumbf|content credentials|dcterms:provenance/i

function textOf(bytes: Uint8Array) {
  try { return new TextDecoder("latin1").decode(bytes) } catch { return new TextDecoder().decode(bytes) }
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}

function shouldRemoveText(text: string, mode: SanitizeMode) {
  if (mode === "all") return true
  if (mode === "c2pa") return C2PA_TEXT.test(text)
  return AI_TEXT.test(text) || (mode === "label" && /digitalsourcetype|made\s+with\s+ai/i.test(text))
}

function sanitizeJpeg(bytes: Uint8Array, mode: SanitizeMode) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("不是有效的 JPEG 文件")
  const parts: Uint8Array[] = [bytes.slice(0, 2)]
  const removed: string[] = []
  let offset = 2

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) { parts.push(bytes.slice(offset)); break }
    let markerOffset = offset
    while (bytes[markerOffset] === 0xff && bytes[markerOffset + 1] === 0xff) markerOffset++
    const marker = bytes[markerOffset + 1]
    if (marker === 0xda || marker === 0xd9) { parts.push(bytes.slice(offset)); break }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.slice(offset, markerOffset + 2)); offset = markerOffset + 2; continue
    }
    if (markerOffset + 4 > bytes.length) break
    const length = (bytes[markerOffset + 2] << 8) | bytes[markerOffset + 3]
    const end = markerOffset + 2 + length
    if (length < 2 || end > bytes.length) throw new Error("JPEG 元数据段损坏")
    const segment = bytes.slice(offset, end)
    const payload = bytes.slice(markerOffset + 4, end)
    const payloadText = textOf(payload)
    const isMetadataMarker = marker === 0xe1 || marker === 0xeb || marker === 0xed || marker === 0xfe
    const isC2paMarker = marker === 0xeb || C2PA_TEXT.test(payloadText)
    const remove = mode === "all"
      ? isMetadataMarker
      : mode === "c2pa"
        ? isC2paMarker
        : isMetadataMarker && shouldRemoveText(payloadText, mode)

    if (remove) {
      removed.push(marker === 0xeb ? "JPEG JUMBF/C2PA" : marker === 0xed ? "JPEG IPTC/Photoshop" : marker === 0xfe ? "JPEG 注释" : "JPEG EXIF/XMP")
    } else {
      parts.push(segment)
    }
    offset = end
  }
  return { bytes: concat(parts), removed }
}

function sanitizePng(bytes: Uint8Array, mode: SanitizeMode) {
  const signature = bytes.slice(0, 8)
  if (signature[0] !== 0x89 || textOf(signature.slice(1, 4)) !== "PNG") throw new Error("不是有效的 PNG 文件")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: Uint8Array[] = [signature]
  const removed: string[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = textOf(bytes.slice(offset + 4, offset + 8))
    const end = offset + 12 + length
    if (end > bytes.length) throw new Error("PNG Chunk 损坏")
    const data = bytes.slice(offset + 8, offset + 8 + length)
    const text = textOf(data)
    const textual = ["tEXt", "zTXt", "iTXt", "eXIf"].includes(type)
    const c2pa = type === "caBX" || type === "C2PA" || C2PA_TEXT.test(text)
    const remove = mode === "all" ? textual || c2pa : mode === "c2pa" ? c2pa : (textual || c2pa) && shouldRemoveText(text, mode)
    if (remove) removed.push(`PNG ${type}`)
    else parts.push(bytes.slice(offset, end))
    offset = end
    if (type === "IEND") break
  }
  return { bytes: concat(parts), removed }
}

function sanitizeWebp(bytes: Uint8Array, mode: SanitizeMode) {
  if (textOf(bytes.slice(0, 4)) !== "RIFF" || textOf(bytes.slice(8, 12)) !== "WEBP") throw new Error("不是有效的 WebP 文件")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: Array<{ type: string; bytes: Uint8Array }> = []
  const removed: string[] = []
  let offset = 12
  let removedExif = false
  let removedXmp = false
  while (offset + 8 <= bytes.length) {
    const type = textOf(bytes.slice(offset, offset + 4))
    const length = view.getUint32(offset + 4, true)
    const end = offset + 8 + length + (length % 2)
    if (end > bytes.length) throw new Error("WebP Chunk 损坏")
    const data = bytes.slice(offset + 8, offset + 8 + length)
    const text = textOf(data)
    const metadata = ["EXIF", "XMP ", "C2PA"].includes(type)
    const c2pa = type === "C2PA" || C2PA_TEXT.test(text)
    const remove = mode === "all" ? metadata : mode === "c2pa" ? c2pa : metadata && shouldRemoveText(text, mode)
    if (remove) {
      removed.push(`WebP ${type.trim()}`)
      if (type === "EXIF") removedExif = true
      if (type === "XMP ") removedXmp = true
    } else chunks.push({ type, bytes: bytes.slice(offset, end) })
    offset = end
  }

  // VP8X usually appears before EXIF/XMP, so update its flags after the full
  // file has been scanned and the removed chunk types are known.
  const normalizedChunks = chunks.map((chunk) => {
    if (chunk.type !== "VP8X" || (!removedExif && !removedXmp)) return chunk.bytes
    const copy = chunk.bytes.slice()
    if (removedExif) copy[8] &= ~0x08
    if (removedXmp) copy[8] &= ~0x04
    return copy
  })
  const body = concat([new TextEncoder().encode("WEBP"), ...normalizedChunks])
  const output = new Uint8Array(8 + body.length)
  output.set(new TextEncoder().encode("RIFF"), 0)
  new DataView(output.buffer).setUint32(4, body.length, true)
  output.set(body, 8)
  return { bytes: output, removed }
}

function getPixelPayload(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") {
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 0xff) break
      const marker = bytes[offset + 1]
      if (marker === 0xda) return bytes.slice(offset)
      if (marker === 0xd9) return bytes.slice(offset)
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (length < 2) break
      offset += 2 + length
    }
  }
  if (mime === "image/png") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const parts: Uint8Array[] = []
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset)
      const type = textOf(bytes.slice(offset + 4, offset + 8))
      if (type === "IDAT") parts.push(bytes.slice(offset + 8, offset + 8 + length))
      offset += 12 + length
    }
    return concat(parts)
  }
  if (mime === "image/webp") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const parts: Uint8Array[] = []
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = textOf(bytes.slice(offset, offset + 4))
      const length = view.getUint32(offset + 4, true)
      if (["VP8 ", "VP8L", "ALPH", "ANIM", "ANMF"].includes(type)) parts.push(bytes.slice(offset, offset + 8 + length + (length % 2)))
      offset += 8 + length + (length % 2)
    }
    return concat(parts)
  }
  return bytes
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes).buffer
  const digest = await crypto.subtle.digest("SHA-256", copy)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function sanitizeImage(file: File, mode: SanitizeMode): Promise<SanitizeResult> {
  const input = new Uint8Array(await file.arrayBuffer())
  const mime = file.type || (input[0] === 0xff ? "image/jpeg" : input[0] === 0x89 ? "image/png" : "image/webp")
  const beforePayloadHash = await sha256(getPixelPayload(input, mime))
  const transformed = mime === "image/jpeg"
    ? sanitizeJpeg(input, mode)
    : mime === "image/png"
      ? sanitizePng(input, mode)
      : mime === "image/webp"
        ? sanitizeWebp(input, mode)
        : (() => { throw new Error("首版只支持 JPEG、PNG 和 WebP") })()
  const afterPayloadHash = await sha256(getPixelPayload(transformed.bytes, mime))
  return {
    blob: new Blob([new Uint8Array(transformed.bytes).buffer], { type: mime }),
    removed: Array.from(new Set(transformed.removed)),
    beforePayloadHash,
    afterPayloadHash,
    pixelsPreserved: beforePayloadHash === afterPayloadHash,
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
