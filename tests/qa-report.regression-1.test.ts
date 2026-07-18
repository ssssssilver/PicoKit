import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import { calculateAge, calculateDateInterval } from "@/components/date-time-tool"
import { createInitialQrPayloads, updateQrPayload } from "@/components/qr-tool"

// Regression: ISSUE-002 — URL draft leaked into the Wi-Fi name after switching QR types.
// Found by /qa on 2026-07-15
// Report: .gstack/qa-reports/qa-report-picokit-modone0622-workers-dev-2026-07-15.md
describe("QA report regressions", () => {
  it("keeps QR payload drafts isolated by content type", () => {
    const initial = createInitialQrPayloads()
    expect(initial.url).toBe("https://tabnative.modone0622.workers.dev")
    expect(initial.wifi).toBe("")

    const withWifi = updateQrPayload(initial, "wifi", "TabNative-WiFi")
    expect(withWifi.url).toBe(initial.url)
    expect(withWifi.wifi).toBe("TabNative-WiFi")
  })

  // Regression: ISSUE-003 — valid date and leap-day age inputs did not update their results.
  // Found by /qa on 2026-07-15
  // Report: .gstack/qa-reports/qa-report-picokit-modone0622-workers-dev-2026-07-15.md
  it("calculates the reported date interval and leap-day age", () => {
    expect(calculateDateInterval("2026-07-01", "2026-07-15")).toEqual({
      days: 14,
      weeks: 2,
      remainingDays: 0,
      hours: 336,
    })
    expect(calculateAge("2000-02-29", "2026-07-15")).toMatchObject({
      years: 26,
      months: 4,
      days: 16,
    })
  })

  // Product update: autoplay is enabled again, but stops when animation is reduced,
  // the page is hidden, or a drag gesture is active.
  it("rotates the hero automatically with motion and visibility safeguards", async () => {
    const source = await readFile("components/home-hero-banner.tsx", "utf8")
    expect(source).toContain("heroRotationMs")
    expect(source).toContain("window.setTimeout")
    expect(source).toContain("prefers-reduced-motion: reduce")
    expect(source).toContain('document.visibilityState === "visible"')
    expect(source).toContain("if (isDragging || reducedMotion || !pageVisible")
  })
})
