/// <reference lib="webworker" />

import { transformImage, type TransformOptions } from "@/lib/image-transformer"

type Request = { id: string; buffer: ArrayBuffer; mime: string; options: TransformOptions }

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, buffer, mime, options } = event.data
  try {
    const result = await transformImage(new Blob([buffer], { type: mime }), options)
    const output = await result.blob.arrayBuffer()
    self.postMessage({ id, ok: true, buffer: output, mime: result.blob.type, width: result.width, height: result.height, quality: result.quality, targetReached: result.targetReached }, [output])
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : "处理失败" })
  }
}

export {}

