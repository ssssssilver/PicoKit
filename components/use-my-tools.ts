"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

import {
  clearRecentTools,
  createEmptyMyToolsState,
  getMyToolHrefs,
  myToolsChangedEvent,
  myToolsStorageKey,
  readMyToolsState,
  toggleFavorite,
  writeMyToolsState,
  type MyToolsState,
} from "@/lib/my-tools"
import { allTools } from "@/lib/site"

const knownToolHrefs = allTools.map((tool) => tool.href)
const serverSnapshot = createEmptyMyToolsState()
let cachedRawValue: string | null | undefined
let cachedSnapshot = serverSnapshot

function getSnapshot() {
  let rawValue: string | null
  try {
    rawValue = window.localStorage.getItem(myToolsStorageKey)
  } catch {
    return serverSnapshot
  }
  if (rawValue === cachedRawValue) return cachedSnapshot
  cachedRawValue = rawValue
  cachedSnapshot = readMyToolsState(window.localStorage, knownToolHrefs)
  return cachedSnapshot
}

function subscribe(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (!event.key || event.key === myToolsStorageKey) onStoreChange()
  }
  window.addEventListener("storage", handleStorage)
  window.addEventListener(myToolsChangedEvent, onStoreChange)
  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(myToolsChangedEvent, onStoreChange)
  }
}

export function useMyTools() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot)

  const update = useCallback((change: (current: MyToolsState) => MyToolsState) => {
    const current = readMyToolsState(window.localStorage, knownToolHrefs)
    const next = change(current)
    if (writeMyToolsState(window.localStorage, next)) {
      window.dispatchEvent(new Event(myToolsChangedEvent))
    }
  }, [])

  return {
    state,
    favoriteHrefs: useMemo(() => new Set(state.favorites), [state.favorites]),
    myToolHrefs: useMemo(() => getMyToolHrefs(state), [state]),
    toggleFavorite: useCallback((href: string) => update((current) => toggleFavorite(current, href)), [update]),
    clearRecent: useCallback(() => update(clearRecentTools), [update]),
    clearAll: useCallback(() => update(() => createEmptyMyToolsState()), [update]),
  }
}
