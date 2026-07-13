/// <reference lib="webworker" />

import { transformCanvas, type TransformOptions } from "@/lib/image-transformer"

type Request = { id: string; buffer: ArrayBuffer; width: number; height: number; options: TransformOptions }

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, buffer, width, height, options } = event.data
  try {
    if (!width || !height || buffer.byteLength !== width * height * 4) throw new Error("图片像素缓冲区无效")
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("浏览器无法创建图片画布")
    context.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0)
    const result = await transformCanvas(canvas, options)
    const output = await result.blob.arrayBuffer()
    self.postMessage({ id, ok: true, buffer: output, mime: result.blob.type, width: result.width, height: result.height, quality: result.quality, targetReached: result.targetReached }, [output])
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : "处理失败" })
  }
}

export {}
