import { describe, expect, it } from "vitest"

import { isPdfDraftExpired, PDF_DRAFT_MAX_AGE_MS } from "@/lib/pdf-workspace-draft"

describe("PDF workspace draft lifetime", () => {
  it("keeps a recent opt-in draft and expires old data", () => {
    const now = 2_000_000_000_000
    expect(isPdfDraftExpired(now - PDF_DRAFT_MAX_AGE_MS + 1, now)).toBe(false)
    expect(isPdfDraftExpired(now - PDF_DRAFT_MAX_AGE_MS - 1, now)).toBe(true)
    expect(isPdfDraftExpired(0, now)).toBe(true)
  })
})
