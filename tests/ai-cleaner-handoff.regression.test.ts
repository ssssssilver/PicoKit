import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const cleanerSource = readFileSync(new URL("../components/one-click-ai-cleaner-tool.tsx", import.meta.url), "utf8")
const detectorSource = readFileSync(new URL("../components/image-inspector-tool.tsx", import.meta.url), "utf8")

describe("AI detector and cleaner regression", () => {
  it("starts image detection as soon as a validated file is selected", () => {
    expect(detectorSource).toContain("if (next) void analyzeRef.current(next)")
    expect(detectorSource).toContain("async function analyze(source: File | null = file)")
    expect(detectorSource).not.toContain('pick("开始检测", "Start local detection")')
    expect(detectorSource).not.toContain("onClick={analyze}")
  })

  it("does not advertise one-click AI removal from detector results", () => {
    expect(detectorSource).not.toContain("onOpenCleaner")
    expect(detectorSource).not.toContain("cleanupHandoff")
    expect(detectorSource).not.toContain('pick("一键去 AI 痕迹", "Clean AI traces in one click")')
  })

  it("does not discard a local image when language hydration reruns the effect", () => {
    for (const source of [cleanerSource, detectorSource]) {
      expect(source).toContain("handoffAttemptedRef.current = true")
      expect(source).toContain("loadLocalAsset(assetId)")
      expect(source).not.toMatch(/loadLocalAsset\(assetId\)[\s\S]{0,300}if \(cancelled\) return/)
    }

    expect(cleanerSource).toContain("setLoadingHandoff(false)")
    expect(detectorSource).toContain("setHandoffLoading(false)")
  })
})
