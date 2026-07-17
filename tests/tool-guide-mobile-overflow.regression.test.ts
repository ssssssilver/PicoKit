import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const articleSource = readFileSync(new URL("../components/tool-guide-article.tsx", import.meta.url), "utf8")

describe("tool guide mobile overflow regression", () => {
  it("allows long localized guide titles to shrink inside the header grid", () => {
    expect(articleSource).toMatch(
      /lg:items-end">[\s\S]*?<div className="min-w-0">[\s\S]*?<h1/,
    )
  })
})
