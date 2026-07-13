import { describe, expect, it } from "vitest"

import { sanitizeImage } from "@/lib/image-sanitizer"

const ascii = (value: string) => new TextEncoder().encode(value)
const concat = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  return bytes
}
const be32 = (value: number) => new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
const le32 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255])
const jpegSegment = (marker: number, text: string) => {
  const payload = ascii(text)
  const length = payload.length + 2
  return concat(new Uint8Array([0xff, marker, length >> 8, length & 255]), payload)
}
const pngChunk = (type: string, data = new Uint8Array()) => concat(be32(data.length), ascii(type), data, new Uint8Array(4))
const webpChunk = (type: string, data: Uint8Array) => concat(ascii(type), le32(data.length), data, data.length % 2 ? new Uint8Array(1) : new Uint8Array())
const asFile = (bytes: Uint8Array, type: string) => new Blob([new Uint8Array(bytes).buffer], { type }) as File

describe("container-level metadata cleanup", () => {
  it("removes selected JPEG AI/C2PA segments and preserves scan data", async () => {
    const scan = concat(new Uint8Array([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0]), new Uint8Array([1, 2, 3, 0xff, 0xd9]))
    const input = concat(
      new Uint8Array([0xff, 0xd8]),
      jpegSegment(0xe1, "XMP Stable Diffusion prompt"),
      jpegSegment(0xe2, "ICC_PROFILE keep me"),
      jpegSegment(0xeb, "JUMBF c2pa manifest"),
      scan,
    )

    const ai = await sanitizeImage(asFile(input, "image/jpeg"), "ai")
    const aiText = new TextDecoder().decode(await ai.blob.arrayBuffer())
    expect(aiText).not.toContain("Stable Diffusion")
    expect(aiText).toContain("ICC_PROFILE")
    expect(aiText).toContain("c2pa manifest")
    expect(ai.pixelsPreserved).toBe(true)

    const c2pa = await sanitizeImage(asFile(input, "image/jpeg"), "c2pa")
    const c2paText = new TextDecoder().decode(await c2pa.blob.arrayBuffer())
    expect(c2paText).toContain("Stable Diffusion")
    expect(c2paText).not.toContain("c2pa manifest")
    expect(c2pa.pixelsPreserved).toBe(true)
  })

  it("removes PNG textual AI data without touching IDAT or unrelated text", async () => {
    const input = concat(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", new Uint8Array(13)),
      pngChunk("tEXt", ascii("parameters\0ComfyUI workflow")),
      pngChunk("tEXt", ascii("Copyright\0Example Studio")),
      pngChunk("IDAT", new Uint8Array([7, 8, 9])),
      pngChunk("IEND"),
    )
    const result = await sanitizeImage(asFile(input, "image/png"), "ai")
    const text = new TextDecoder().decode(await result.blob.arrayBuffer())
    expect(text).not.toContain("ComfyUI")
    expect(text).toContain("Example Studio")
    expect(result.pixelsPreserved).toBe(true)
  })

  it.each(["ai", "label"] as const)("removes AI provenance stored in a PNG caBX chunk in %s mode", async (mode) => {
    const input = concat(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", new Uint8Array(13)),
      pngChunk("caBX", ascii("c2pa.actions digitalSourceType=trainedAlgorithmicMedia generator=gpt-image")),
      pngChunk("IDAT", new Uint8Array([7, 8, 9])),
      pngChunk("IEND"),
    )
    const result = await sanitizeImage(asFile(input, "image/png"), mode)
    const text = new TextDecoder().decode(await result.blob.arrayBuffer())
    expect(text).not.toContain("trainedAlgorithmicMedia")
    expect(result.removed).toContain("PNG caBX")
    expect(result.pixelsPreserved).toBe(true)
  })

  it("clears WebP VP8X metadata flags after removing later chunks", async () => {
    const vp8x = new Uint8Array(10)
    vp8x[0] = 0x0c
    const body = concat(
      ascii("WEBP"),
      webpChunk("VP8X", vp8x),
      webpChunk("EXIF", ascii("Stable Diffusion")),
      webpChunk("XMP ", ascii("Made with AI")),
      webpChunk("VP8 ", new Uint8Array([1, 2, 3, 4])),
    )
    const input = concat(ascii("RIFF"), le32(body.length), body)
    const result = await sanitizeImage(asFile(input, "image/webp"), "all")
    const output = new Uint8Array(await result.blob.arrayBuffer())
    const text = new TextDecoder().decode(output)
    expect(text).not.toContain("EXIF")
    expect(text).not.toContain("XMP ")
    expect(output[20]).toBe(0)
    expect(result.pixelsPreserved).toBe(true)
  })
})
