import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import { IMAGE_PIPELINE_BATCH_MAX_ITEMS, isLocalAssetExpired, localAssetBatchFiles, LOCAL_ASSET_BATCH_MAX_BYTES, LOCAL_ASSET_BATCH_MAX_ITEMS, LOCAL_ASSET_MAX_AGE_MS, type LocalAssetBatchRecord } from "@/lib/local-asset-transfer"

describe("local image handoff", () => {
  it("keeps fresh assets available", () => {
    const now = LOCAL_ASSET_MAX_AGE_MS * 2
    expect(isLocalAssetExpired(now - LOCAL_ASSET_MAX_AGE_MS + 1, now)).toBe(false)
  })

  it("expires stale or invalid records", () => {
    const now = LOCAL_ASSET_MAX_AGE_MS * 2
    expect(isLocalAssetExpired(now - LOCAL_ASSET_MAX_AGE_MS - 1, now)).toBe(true)
    expect(isLocalAssetExpired(Number.NaN, now)).toBe(true)
    expect(isLocalAssetExpired(0, now)).toBe(true)
  })

  it("rebuilds an ordered file queue from one local batch record", () => {
    const record: LocalAssetBatchRecord = {
      id: "batch-1",
      kind: "batch",
      source: "background-remover",
      createdAt: 1234,
      items: [
        { blob: new Blob(["a"], { type: "image/png" }), name: "first.png", type: "image/png", size: 1 },
        { blob: new Blob(["bb"], { type: "image/webp" }), name: "second.webp", type: "image/webp", size: 2 },
      ],
    }

    const files = localAssetBatchFiles(record)
    expect(files.map((file) => file.name)).toEqual(["first.png", "second.webp"])
    expect(files.map((file) => file.type)).toEqual(["image/png", "image/webp"])
    expect(files.every((file) => file.lastModified === 1234)).toBe(true)
    expect(IMAGE_PIPELINE_BATCH_MAX_ITEMS).toBe(30)
    expect(LOCAL_ASSET_BATCH_MAX_ITEMS).toBe(IMAGE_PIPELINE_BATCH_MAX_ITEMS)
    expect(LOCAL_ASSET_BATCH_MAX_BYTES).toBe(250 * 1024 * 1024)
  })

  it("uses one 30-image limit across the complete image pipeline", async () => {
    const [remover, editor, optimizer] = await Promise.all([
      readFile("components/background-removal-batch-studio.tsx", "utf8"),
      readFile("components/quick-image-editor.tsx", "utf8"),
      readFile("components/image-delivery-studio.tsx", "utf8"),
    ])

    for (const source of [remover, editor, optimizer]) {
      expect(source).toContain("IMAGE_PIPELINE_BATCH_MAX_ITEMS")
    }
    expect(optimizer).not.toContain("maxBatchFiles = 50")
  })

  it("subscribes to IndexedDB completion before requests can finish", async () => {
    const source = await readFile("lib/local-asset-transfer.ts", "utf8")
    expect(source.match(/const completed = transactionDone\(transaction\)/g)).toHaveLength(6)
    expect(source).not.toContain("await transactionDone(transaction)")
    expect(source).not.toContain("void cleanExpiredLocalAssets(createdAt)")
    expect(source.match(/await cleanExpiredLocalAssets\(createdAt\)/g)).toHaveLength(2)
  })
})
