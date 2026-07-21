import { describe, expect, it } from "vitest"

import { applySubtleSensorNoise } from "@/lib/browser-camera-normalizer"

describe("browser camera normalizer", () => {
  it("adds only subtle deterministic grain while preserving alpha", () => {
    const pixels = new Uint8ClampedArray([
      120, 130, 140, 255,
      20, 30, 40, 0,
      240, 230, 220, 128,
    ])
    const image = { data: pixels, width: 3, height: 1, colorSpace: "srgb" } as ImageData

    expect(applySubtleSensorNoise(image, 12345)).toBe(true)
    expect(pixels[3]).toBe(255)
    expect(pixels[7]).toBe(0)
    expect(pixels[11]).toBe(128)
    expect(pixels.slice(4, 7)).toEqual(new Uint8ClampedArray([20, 30, 40]))
    expect(Math.abs(pixels[0] - 120)).toBeLessThanOrEqual(4)
    expect(Math.abs(pixels[1] - 130)).toBeLessThanOrEqual(4)
    expect(Math.abs(pixels[2] - 140)).toBeLessThanOrEqual(4)
  })

  it("reports opaque images without introducing transparency", () => {
    const pixels = new Uint8ClampedArray([80, 90, 100, 255, 150, 160, 170, 255])
    const image = { data: pixels, width: 2, height: 1, colorSpace: "srgb" } as ImageData

    expect(applySubtleSensorNoise(image, 7)).toBe(false)
    expect(pixels[3]).toBe(255)
    expect(pixels[7]).toBe(255)
  })
})
