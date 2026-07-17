"use client"

import { useEffect } from "react"

import { cleanExpiredLocalAssets } from "@/lib/local-asset-transfer"

export function LocalAssetJanitor() {
  useEffect(() => {
    void cleanExpiredLocalAssets().catch(() => undefined)
  }, [])

  return null
}
