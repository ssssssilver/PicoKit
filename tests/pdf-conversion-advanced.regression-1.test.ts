import { describe, expect, it } from "vitest"

import { parsePdfSplitSpec, resolvePdfTargetSize } from "@/lib/pdf-conversion"

describe("advanced PDF conversion helpers", () => {
  it("parses semicolon and newline separated split groups", () => {
    expect(parsePdfSplitSpec("1-3; 4,6\n7-9", 8)).toEqual([
      { label: "1-3", pageIndexes: [0, 1, 2] },
      { label: "4,6", pageIndexes: [3, 5] },
      { label: "7-9", pageIndexes: [6, 7] },
    ])
  })

  it("drops empty split groups and clamps page ranges", () => {
    expect(parsePdfSplitSpec("0; 2-20; nonsense", 4)).toEqual([
      { label: "2-20", pageIndexes: [1, 2, 3] },
    ])
  })

  it("resolves original and standard page sizes without distortion", () => {
    expect(resolvePdfTargetSize(500, 700, "original", "auto", 18)).toEqual({ width: 536, height: 736 })
    expect(resolvePdfTargetSize(900, 600, "a4", "auto", 0)).toEqual({ width: 841.89, height: 595.28 })
    expect(resolvePdfTargetSize(900, 600, "letter", "portrait", 0)).toEqual({ width: 612, height: 792 })
  })
})
