import type { ImageSignal } from "@/lib/image-types"

type LocalizedPicker = (zh: string, en: string) => string

export function localizedImageSignalLabel(
  signal: ImageSignal,
  pick: LocalizedPicker,
) {
  if (signal.id === "c2pa-container") {
    return pick("检测到 C2PA/JUMBF 容器", "C2PA/JUMBF container detected")
  }
  if (signal.id === "software") return pick("写入软件", "Writing software")
  if (signal.id === "camera") return pick("相机信息", "Camera information")
  if (signal.id.startsWith("ai-")) {
    return pick(signal.label, "AI generator or workflow metadata")
  }
  return signal.label
}
