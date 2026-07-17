import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const articleSource = readFileSync(new URL("../components/tool-guide-article.tsx", import.meta.url), "utf8")

describe("tool guide mobile grid regression", () => {
  it("uses a shrinkable single-column track before the desktop breakpoint", () => {
    expect(articleSource).toContain(
      "grid grid-cols-[minmax(0,1fr)] gap-9 lg:grid-cols-[minmax(0,1fr)_250px]",
    )
  })
})
