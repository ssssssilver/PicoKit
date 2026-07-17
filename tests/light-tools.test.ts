import { describe, expect, it } from "vitest"

import { contrastRatio, extractPalette, parseHexColor, rgbToHsl } from "@/components/color-tool"
import { calculateAge, calculateDateInterval, parseDateTimeInput } from "@/components/date-time-tool"
import { generatePasswordFromSets, secureRandomString } from "@/components/password-uuid-tool"
import { parsePickerEntries, shuffleWithCrypto } from "@/components/random-picker-tool"
import { parseUrlDetails } from "@/components/regex-url-tool"
import { formatElapsed } from "@/components/screen-recorder-tool"
import { inspectSvgDimensions, minifySvg } from "@/components/svg-tool"
import { formatDuration } from "@/components/timer-tool"
import { calculateRatio, greatestCommonDivisor } from "@/components/unit-ratio-tool"

describe("priority-one lightweight tools", () => {
  it("generates passwords only from the selected pool", () => {
    const password = secureRandomString(64, "abc123")
    expect(password).toHaveLength(64)
    expect(password).toMatch(/^[abc123]+$/)
    const ruledPassword = generatePasswordFromSets(20, ["abc", "XYZ", "123", "!@#"])
    expect(ruledPassword).toMatch(/[a-c]/)
    expect(ruledPassword).toMatch(/[X-Z]/)
    expect(ruledPassword).toMatch(/[1-3]/)
    expect(ruledPassword).toMatch(/[!@#]/)
  })

  it("parses timestamps and calculates dates without local-time drift", () => {
    expect(parseDateTimeInput("0")?.toISOString()).toBe("1970-01-01T00:00:00.000Z")
    expect(parseDateTimeInput("1710000000000")?.getTime()).toBe(1710000000000)
    expect(calculateDateInterval("2026-07-01", "2026-07-14")).toMatchObject({ days: 13, weeks: 1, remainingDays: 6 })
    expect(calculateAge("2000-01-01", "2026-07-14")).toMatchObject({ years: 26, months: 6, days: 13 })
  })

  it("calculates simplified ratios and proportional dimensions", () => {
    expect(greatestCommonDivisor(1920, 1080)).toBe(120)
    expect(calculateRatio(1920, 1080, 1280)).toMatchObject({ ratioWidth: 16, ratioHeight: 9, targetHeight: 720 })
  })

  it("converts colors, contrast, and image samples", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 })
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21)
    expect(extractPalette(new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255]), 2)).toEqual(["#FF0000", "#0000FF"])
  })

  it("parses URLs without requesting them", () => {
    expect(parseUrlDetails("https://example.com/a?x=1&x=2#b")).toEqual({ origin: "https://example.com", pathname: "/a", hash: "#b", parameters: [["x", "1"], ["x", "2"]] })
    expect(parseUrlDetails("not a url")).toBeNull()
  })
})

describe("priority-two lightweight tools", () => {
  it("minifies SVG and reads viewBox dimensions", () => {
    const svg = '<svg viewBox="0 0 640 360">\n <!--x--> <path d="M0 0"/>\n</svg>'
    expect(minifySvg(svg)).toBe('<svg viewBox="0 0 640 360"><path d="M0 0"/></svg>')
    expect(inspectSvgDimensions(svg)).toEqual({ width: 640, height: 360, ratio: 640 / 360 })
  })

  it("prepares picker entries and shuffles without losing candidates", () => {
    expect(parsePickerEntries("A\nB\nA\n", true)).toEqual(["A", "B"])
    expect(shuffleWithCrypto(["A", "B", "C"]).sort()).toEqual(["A", "B", "C"])
  })

  it("formats timers and recording durations", () => {
    expect(formatDuration(3661)).toBe("01:01:01")
    expect(formatDuration(65)).toBe("01:05")
    expect(formatElapsed(65)).toBe("01:05")
  })
})
