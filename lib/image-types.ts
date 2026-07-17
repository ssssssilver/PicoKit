export type SignalSeverity = "high" | "medium" | "info"

export type ImageSignal = {
  id: string
  label: string
  value: string
  group: "c2pa" | "ai" | "software" | "camera" | "file"
  severity: SignalSeverity
}

export type MetadataEntry = {
  key: string
  value: string
}

export type C2paInspection = {
  present: boolean
  validated: boolean | null
  summary: string
  manifest?: unknown
}

export type ImageInspection = {
  fileName: string
  mime: string
  format: string
  bytes: number
  sha256?: string
  inspectedAt?: string
  width?: number
  height?: number
  metadata: MetadataEntry[]
  signals: ImageSignal[]
  c2pa: C2paInspection
  risk: "signals-found" | "no-signals" | "unknown"
  note: string
}

export type SanitizeMode = "ai" | "c2pa" | "label" | "all"

export type SanitizeResult = {
  blob: Blob
  removed: string[]
  beforePayloadHash: string
  afterPayloadHash: string
  pixelsPreserved: boolean
}
