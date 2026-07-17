import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("screen recorder permissions policy", () => {
  it("allows first-party display capture and optional microphone access", () => {
    const source = readFileSync(
      new URL("../worker/index.ts", import.meta.url),
      "utf8",
    )
    expect(source).toContain("display-capture=(self)")
    expect(source).toContain("microphone=(self)")
    expect(source).toContain("camera=()")
    expect(source).not.toContain("microphone=()")
  })
})
