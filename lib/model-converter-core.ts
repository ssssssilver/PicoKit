export const modelInputExtensions = ["glb", "gltf", "obj", "fbx", "stl", "ply"] as const
export const modelOutputFormats = ["glb", "obj", "stl", "ply"] as const

export type ModelInputFormat = (typeof modelInputExtensions)[number]
export type ModelOutputFormat = (typeof modelOutputFormats)[number]

const primaryPriority: Record<ModelInputFormat, number> = {
  glb: 0,
  gltf: 1,
  fbx: 2,
  obj: 3,
  stl: 4,
  ply: 5,
}

export function modelExtension(name: string): string {
  return name.toLowerCase().split(".").pop() ?? ""
}

export function isModelInputFormat(value: string): value is ModelInputFormat {
  return modelInputExtensions.includes(value as ModelInputFormat)
}

export function selectPrimaryModelFile<T extends { name: string }>(files: T[]): T | null {
  return files
    .filter((file) => isModelInputFormat(modelExtension(file.name)))
    .sort((a, b) => primaryPriority[modelExtension(a.name) as ModelInputFormat] - primaryPriority[modelExtension(b.name) as ModelInputFormat])[0] ?? null
}

export function modelOutputName(inputName: string, output: ModelOutputFormat): string {
  const base = inputName.replace(/\.[^.]+$/, "") || "model"
  return `${base}-converted.${output}`
}

export function outputKeepsRichScene(format: ModelOutputFormat) {
  return format === "glb"
}

export function modelAcceptValue() {
  return modelInputExtensions.map((extension) => `.${extension}`).join(",")
}
