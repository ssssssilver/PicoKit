import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const cleanerSource = readFileSync(new URL("../components/one-click-ai-cleaner-tool.tsx", import.meta.url), "utf8")
const detectorSource = readFileSync(new URL("../components/image-inspector-tool.tsx", import.meta.url), "utf8")

describe("AI detector and cleaner handoff regression", () => {
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
