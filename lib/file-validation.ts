export type ImageValidation = {
  mime: "image/jpeg" | "image/png" | "image/webp"
  format: "JPEG" | "PNG" | "WebP"
}

export function detectImageType(bytes: Uint8Array): ImageValidation | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", format: "JPEG" }
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", format: "PNG" }
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mime: "image/webp", format: "WebP" }
  }
  return null
}

export async function validateImageFile(file: File, maxPixels = 64_000_000) {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const detected = detectImageType(header)
  if (!detected) throw new Error("文件内容不是受支持的 JPG、PNG 或 WebP 图片")
  if (file.type && file.type !== detected.mime) throw new Error(`文件扩展信息与实际 ${detected.format} 内容不一致`)

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const pixels = bitmap.width * bitmap.height
    if (!pixels || pixels > maxPixels) {
      throw new Error(`图片像素不能超过 ${(maxPixels / 1_000_000).toFixed(0)}MP`)
    }
    return { ...detected, width: bitmap.width, height: bitmap.height, pixels }
  } catch (error) {
    if (error instanceof Error && error.message.includes("图片像素不能超过")) throw error
    throw new Error("浏览器无法解码这张图片，文件可能已损坏")
  } finally {
    bitmap?.close()
  }
}
