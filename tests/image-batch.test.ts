import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import {
  buildBatchOutputName,
  buildBatchOutputNames,
  makeUniqueBatchName,
  runSequentialBatch,
  sourceImageStem,
  toBatchTransformOptions,
} from "@/lib/image-batch"

describe("batch image delivery naming", () => {
  it("renders safe template variables and preserves multi-dot source stems", () => {
    expect(buildBatchOutputName("campaign.hero.final.PNG", 2, "image/webp", "{index}-{name}.{ext}"))
      .toBe("03-campaign.hero.final.webp")
    expect(buildBatchOutputName("../unsafe:name.jpg", 0, "image/jpeg", "{name}/delivery"))
      .toBe("unsafe-name-delivery.jpg")
    expect(sourceImageStem("CON.png")).toBe("_CON")
  })

  it("deduplicates requested names case-insensitively", () => {
    const used = new Set<string>()
    expect(makeUniqueBatchName("photo.webp", used)).toBe("photo.webp")
    expect(makeUniqueBatchName("PHOTO.webp", used)).toBe("PHOTO-2.webp")
    expect(makeUniqueBatchName("photo.webp", used)).toBe("photo-3.webp")

    expect(buildBatchOutputNames(["same.jpg", "same.png", "SAME.webp"], {
      format: "image/png",
      nameTemplate: "{name}",
    })).toEqual(["same.png", "same-2.png", "SAME-3.png"])
  })
})

describe("batch image delivery transform settings", () => {
  it("clamps browser-safe values and enables target bytes for lossy formats", () => {
    expect(toBatchTransformOptions({
      format: "image/jpeg",
      quality: 105,
      maxEdge: 20_000,
      targetKb: 200,
      nameTemplate: "{name}",
    })).toMatchObject({
      format: "image/jpeg",
      quality: 1,
      maxEdge: 12_000,
      targetBytes: 204_800,
      aspect: "original",
    })
  })

  it("keeps target sizing off for lossless PNG output", () => {
    expect(toBatchTransformOptions({
      format: "image/png",
      quality: 82,
      maxEdge: undefined,
      targetKb: 200,
      nameTemplate: "{name}",
    })).toEqual({
      format: "image/png",
      quality: 0.82,
      maxEdge: undefined,
      aspect: "original",
      targetBytes: undefined,
    })
  })
})

describe("sequential batch runner", () => {
  it("never runs two tasks concurrently and retains input order", async () => {
    let active = 0
    let peak = 0
    const started: number[] = []
    const settled: number[] = []

    const results = await runSequentialBatch([1, 2, 3], async (item) => {
      active += 1
      peak = Math.max(peak, active)
      started.push(item)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      if (item === 2) throw new Error("expected failure")
      return item * 10
    }, {
      onSettled: (result) => settled.push(result.item),
    })

    expect(peak).toBe(1)
    expect(started).toEqual([1, 2, 3])
    expect(settled).toEqual([1, 2, 3])
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"])
  })

  it("stops before starting the next item", async () => {
    let stop = false
    const results = await runSequentialBatch(["a", "b", "c"], async (item) => {
      stop = true
      return item.toUpperCase()
    }, { shouldStop: () => stop })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ item: "a", status: "fulfilled", value: "A" })
  })
})

describe("batch delivery page continuity", () => {
  it("restores the queue after navigating to another workflow step and shows upload progress", async () => {
    const studio = await readFile("components/image-delivery-studio.tsx", "utf8")
    expect(studio).toContain('workflowMemory.get<DeliveryQueueSnapshot>("image-compressor")')
    expect(studio).toContain('workflowMemory.set<DeliveryQueueSnapshot>("image-compressor"')
    expect(studio).toContain("await waitForBrowserPaint()")
    expect(studio).toContain('aria-live="polite"')
  })
})
