export const myToolsStorageKey = "picokit:my-tools:v1"
export const myToolsChangedEvent = "picokit:my-tools-changed"
export const maxRecentTools = 8

export type RecentTool = {
  href: string
  lastUsedAt: number
}

export type MyToolsState = {
  version: 1
  favorites: string[]
  recent: RecentTool[]
}

export function createEmptyMyToolsState(): MyToolsState {
  return { version: 1, favorites: [], recent: [] }
}

export function normalizeMyToolsState(value: unknown, knownHrefs: readonly string[]): MyToolsState {
  if (!value || typeof value !== "object") return createEmptyMyToolsState()

  const source = value as Partial<MyToolsState>
  const known = new Set(knownHrefs)
  const favorites = Array.isArray(source.favorites)
    ? [...new Set(source.favorites.filter((href): href is string => typeof href === "string" && known.has(href)))]
    : []
  const recent = Array.isArray(source.recent)
    ? source.recent
        .filter((item): item is RecentTool => Boolean(
          item
          && typeof item === "object"
          && typeof item.href === "string"
          && known.has(item.href)
          && Number.isFinite(item.lastUsedAt),
        ))
        .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
        .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index)
        .slice(0, maxRecentTools)
    : []

  return { version: 1, favorites, recent }
}

export function readMyToolsState(storage: Pick<Storage, "getItem">, knownHrefs: readonly string[]): MyToolsState {
  try {
    const raw = storage.getItem(myToolsStorageKey)
    return raw ? normalizeMyToolsState(JSON.parse(raw), knownHrefs) : createEmptyMyToolsState()
  } catch {
    return createEmptyMyToolsState()
  }
}

export function writeMyToolsState(storage: Pick<Storage, "setItem">, state: MyToolsState) {
  try {
    storage.setItem(myToolsStorageKey, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function toggleFavorite(state: MyToolsState, href: string): MyToolsState {
  const favorites = state.favorites.includes(href)
    ? state.favorites.filter((item) => item !== href)
    : [href, ...state.favorites]
  return { ...state, favorites }
}

export function recordRecentTool(state: MyToolsState, href: string, lastUsedAt = Date.now()): MyToolsState {
  return {
    ...state,
    recent: [{ href, lastUsedAt }, ...state.recent.filter((item) => item.href !== href)].slice(0, maxRecentTools),
  }
}

export function clearRecentTools(state: MyToolsState): MyToolsState {
  return { ...state, recent: [] }
}

export function getMyToolHrefs(state: MyToolsState) {
  const recentHrefs = state.recent.map((item) => item.href)
  return [...state.favorites, ...recentHrefs.filter((href) => !state.favorites.includes(href))]
}
