import { describe, expect, it } from "vitest"

import {
  BACKGROUND_FINISH_MAX_PIXELS,
  DEFAULT_BACKGROUND_FINISH_SETTINGS,
  backgroundFinishCanvasSize,
  backgroundFinishOutputName,
  normalizeBackgroundFinishSettings,
} from "@/lib/background-finish"

describe("background finish settings", () => {
  it("provides practical local canvas presets", () => {
    expect(backgroundFinishCanvasSize(1600, 1200, { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, canvasPreset: "original" })).toEqual({ width: 1600, height: 1200 })
    expect(backgroundFinishCanvasSize(1600, 1200, { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, canvasPreset: "square" })).toEqual({ width: 1080, height: 1080 })
    expect(backgroundFinishCanvasSize(1600, 1200, { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, canvasPreset: "portrait" })).toEqual({ width: 1080, height: 1350 })
    expect(backgroundFinishCanvasSize(1600, 1200, { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, canvasPreset: "story" })).toEqual({ width: 1080, height: 1920 })
    expect(backgroundFinishCanvasSize(1600, 1200, { ...DEFAULT_BACKGROUND_FINISH_SETTINGS, canvasPreset: "marketplace" })).toEqual({ width: 2000, height: 2000 })
  })

  it("clamps custom canvases and interactive effect values", () => {
    const settings = normalizeBackgroundFinishSettings({
      canvasPreset: "custom",
      customWidth: 99999,
      customHeight: 99999,
      subjectScale: 999,
      subjectX: -999,
      shadowOpacity: 999,
      shadowBlur: -10,
      quality: 5,
      color: "not-a-color",
    })
    const size = backgroundFinishCanvasSize(100, 100, settings)

    expect(size.width * size.height).toBeLessThanOrEqual(BACKGROUND_FINISH_MAX_PIXELS)
    expect(settings.subjectScale).toBe(140)
    expect(settings.subjectX).toBe(-50)
    expect(settings.shadowOpacity).toBe(100)
    expect(settings.shadowBlur).toBe(0)
    expect(settings.quality).toBe(40)
    expect(settings.color).toBe("#ffffff")
  })

  it("uses an extension that matches the selected encoder", () => {
    expect(backgroundFinishOutputName("product.png", "image/png")).toBe("product-removebg-tabnative.png")
    expect(backgroundFinishOutputName("product.png", "image/webp")).toBe("product-removebg-tabnative.webp")
    expect(backgroundFinishOutputName("product.png", "image/jpeg")).toBe("product-removebg-tabnative.jpg")
  })
})
