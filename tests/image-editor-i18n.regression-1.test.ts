import { describe, expect, it } from "vitest"

import { loadTranslations } from "@/lib/locales"

// Regression: ISSUE-001 — Arabic image-editor controls used English transliterations and incorrect action labels.
// Found by /qa on 2026-07-15
// Report: .gstack/qa-reports/qa-report-tabnative-modone0622-workers-dev-2026-07-15.md
describe("quick image editor Arabic terminology", () => {
  it("uses clear native labels for editing actions", async () => {
    const messages = await loadTranslations("ar")

    expect({
      Arrow: messages.Arrow,
      Free: messages.Free,
      Redo: messages.Redo,
      Select: messages.Select,
      StrokeWidth: messages["Stroke width"],
      ZoomIn: messages["Zoom in"],
      ZoomOut: messages["Zoom out"],
    }).toEqual({
      Arrow: "سهم",
      Free: "حر",
      Redo: "إعادة التنفيذ",
      Select: "تحديد",
      StrokeWidth: "سُمك الخط",
      ZoomIn: "تكبير",
      ZoomOut: "تصغير",
    })
  })
})
