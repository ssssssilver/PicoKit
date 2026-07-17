import type { AnimationClip, Object3D } from "three"

import type { ModelOutputFormat } from "@/lib/model-converter-core"

export async function exportModelData(root: Object3D, animations: AnimationClip[], format: ModelOutputFormat, maxTextureSize: number): Promise<Blob> {
  root.updateMatrixWorld(true)
  if (format === "glb") {
    const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js")
    const result = await new GLTFExporter().parseAsync(root, { binary: true, animations, maxTextureSize, onlyVisible: true })
    if (!(result instanceof ArrayBuffer)) throw new Error("GLB export returned an unexpected result")
    return new Blob([result], { type: "model/gltf-binary" })
  }
  if (format === "obj") {
    const { OBJExporter } = await import("three/addons/exporters/OBJExporter.js")
    return new Blob([new OBJExporter().parse(root)], { type: "text/plain;charset=utf-8" })
  }
  if (format === "stl") {
    const { STLExporter } = await import("three/addons/exporters/STLExporter.js")
    const result = new STLExporter().parse(root, { binary: true })
    return new Blob([result.buffer], { type: "model/stl" })
  }
  const { PLYExporter } = await import("three/addons/exporters/PLYExporter.js")
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    try { new PLYExporter().parse(root, resolve, { binary: true, littleEndian: true }) } catch (reason) { reject(reason) }
  })
  return new Blob([result], { type: "application/octet-stream" })
}
