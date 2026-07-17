import { describe, expect, it } from "vitest"

import {
  clearRecentTools,
  createEmptyMyToolsState,
  getMyToolHrefs,
  maxRecentTools,
  normalizeMyToolsState,
  readMyToolsState,
  recordRecentTool,
  toggleFavorite,
  writeMyToolsState,
} from "@/lib/my-tools"

const knownHrefs = ["/image-compressor", "/pdf-tools", "/qr-code-tool"]

describe("My tools local state", () => {
  it("keeps known favorites and ordered, deduplicated recent tools", () => {
    const state = normalizeMyToolsState({
      favorites: ["/pdf-tools", "/missing", "/pdf-tools"],
      recent: [
        { href: "/qr-code-tool", lastUsedAt: 10 },
        { href: "/image-compressor", lastUsedAt: 30 },
        { href: "/qr-code-tool", lastUsedAt: 20 },
        { href: "/missing", lastUsedAt: 40 },
      ],
    }, knownHrefs)

    expect(state.favorites).toEqual(["/pdf-tools"])
    expect(state.recent).toEqual([
      { href: "/image-compressor", lastUsedAt: 30 },
      { href: "/qr-code-tool", lastUsedAt: 20 },
    ])
    expect(getMyToolHrefs(state)).toEqual(["/pdf-tools", "/image-compressor", "/qr-code-tool"])
  })

  it("toggles favorites and moves the latest visit to the front", () => {
    let state = createEmptyMyToolsState()
    state = toggleFavorite(state, "/pdf-tools")
    state = recordRecentTool(state, "/image-compressor", 10)
    state = recordRecentTool(state, "/pdf-tools", 20)
    state = recordRecentTool(state, "/image-compressor", 30)

    expect(state.favorites).toEqual(["/pdf-tools"])
    expect(state.recent).toEqual([
      { href: "/image-compressor", lastUsedAt: 30 },
      { href: "/pdf-tools", lastUsedAt: 20 },
    ])
    expect(clearRecentTools(state).recent).toEqual([])
    expect(toggleFavorite(state, "/pdf-tools").favorites).toEqual([])
  })

  it("caps recent history and safely persists valid state", () => {
    let state = createEmptyMyToolsState()
    const hrefs = Array.from({ length: maxRecentTools + 3 }, (_, index) => `/tool-${index}`)
    hrefs.forEach((href, index) => {
      state = recordRecentTool(state, href, index)
    })
    expect(state.recent).toHaveLength(maxRecentTools)

    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const validState = { version: 1 as const, favorites: ["/pdf-tools"], recent: [] }
    expect(writeMyToolsState(storage, validState)).toBe(true)
    expect(readMyToolsState(storage, knownHrefs)).toEqual(validState)
  })
})
