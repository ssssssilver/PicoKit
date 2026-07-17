"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { myToolsChangedEvent, readMyToolsState, recordRecentTool, writeMyToolsState } from "@/lib/my-tools"
import { allTools } from "@/lib/site"

const knownToolHrefs = allTools.map((tool) => tool.href)
const knownToolHrefSet = new Set(knownToolHrefs)

export function ToolVisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const currentPathname = window.location.pathname || pathname
    const normalizedPath = currentPathname !== "/" ? currentPathname.replace(/\/$/, "") : currentPathname
    if (!knownToolHrefSet.has(normalizedPath)) return

    const current = readMyToolsState(window.localStorage, knownToolHrefs)
    const next = recordRecentTool(current, normalizedPath)
    if (writeMyToolsState(window.localStorage, next)) {
      window.dispatchEvent(new Event(myToolsChangedEvent))
    }
  }, [pathname])

  return <span hidden aria-hidden="true" data-tool-visit-tracker="" />
}
