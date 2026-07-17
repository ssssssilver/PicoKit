import { describe, expect, it } from "vitest"

import { localizedImageSignalLabel } from "@/lib/image-signal-label"
import type { ImageSignal } from "@/lib/image-types"

const signal = (id: string, group: ImageSignal["group"]): ImageSignal => ({
  id,
  group,
  label: "中文内部标签",
  value: "value",
  severity: "high",
})

describe("localized image signal labels", () => {
  const english = (_zh: string, en: string) => en

  it("does not expose internal Chinese labels to non-Chinese interfaces", () => {
    expect(localizedImageSignalLabel(signal("ai-0", "ai"), english)).toBe(
      "AI generator or workflow metadata",
    )
    expect(localizedImageSignalLabel(signal("c2pa-container", "c2pa"), english)).toBe(
      "C2PA/JUMBF container detected",
    )
    expect(localizedImageSignalLabel(signal("software", "software"), english)).toBe(
      "Writing software",
    )
    expect(localizedImageSignalLabel(signal("camera", "camera"), english)).toBe(
      "Camera information",
    )
  })
})
