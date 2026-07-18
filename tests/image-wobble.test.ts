import { describe, expect, it } from "vitest"

import {
  defaultWobbleSettings,
  fitWobbleDimensions,
  normalizeWobbleSettings,
  preferredVideoMime,
  wobbleOutputName,
  wobblePresets,
  wobbleVector,
} from "@/lib/image-wobble"

describe("image wobble helpers", () => {
  it("keeps all presets valid and uniquely named", () => {
    expect(wobblePresets).toHaveLength(6)
    expect(new Set(wobblePresets.map((preset) => preset.id)).size).toBe(wobblePresets.length)
    for (const preset of wobblePresets) {
      const settings = normalizeWobbleSettings(preset.settings)
      expect(settings.strength).toBeGreaterThanOrEqual(0)
      expect(settings.strength).toBeLessThanOrEqual(100)
      expect(settings.speed).toBeGreaterThanOrEqual(.2)
      expect(settings.speed).toBeLessThanOrEqual(3)
    }
  })

  it("fits large images without enlarging small ones", () => {
    expect(fitWobbleDimensions(4000, 2000, 1600)).toEqual({ width: 1600, height: 800, scale: .4 })
    expect(fitWobbleDimensions(640, 480, 1600)).toEqual({ width: 640, height: 480, scale: 1 })
  })

  it("uses manual force before automatic motion", () => {
    expect(wobbleVector(0, defaultWobbleSettings, { x: 2, y: 0 })).toEqual({ x: 1, y: 0 })
    expect(wobbleVector(.25, { ...defaultWobbleSettings, auto: false })).toEqual({ x: 0, y: 0 })
    expect(Math.abs(wobbleVector(.25, defaultWobbleSettings).x)).toBeGreaterThan(.1)
  })

  it("builds safe output names and selects supported recording formats", () => {
    expect(wobbleOutputName("portrait.final.png", "gif")).toBe("portrait.final-wobble.gif")
    expect(preferredVideoMime("webm", (mime) => mime === "video/webm;codecs=vp8")).toBe("video/webm;codecs=vp8")
    expect(preferredVideoMime("mp4", () => false)).toBe("")
  })
})
