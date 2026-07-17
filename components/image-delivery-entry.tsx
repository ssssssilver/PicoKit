"use client"

import { useEffect, useRef, useState } from "react"

import { ImageDeliveryStudio } from "@/components/image-delivery-studio"
import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { loadLocalAsset, loadLocalAssetBatch, localAssetBatchFiles, localAssetFile } from "@/lib/local-asset-transfer"

export function ImageDeliveryEntry() {
  const { pick } = useLanguage()
  const attemptedRef = useRef(false)
  const [initialFiles, setInitialFiles] = useState<readonly File[]>([])
  const [handoffError, setHandoffError] = useState("")

  useEffect(() => {
    if (attemptedRef.current) return
    attemptedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const batchId = params.get("batch")
    const assetId = params.get("asset")
    if (!batchId && !assetId) return
    void (batchId ? loadLocalAssetBatch(batchId) : loadLocalAsset(assetId!))
      .then((record) => {
        if (!record) throw new Error(pick("临时图片队列已过期，请从上一步重新发送。", "The temporary image queue has expired. Send it again from the previous tool."))
        setInitialFiles("kind" in record ? localAssetBatchFiles(record) : [localAssetFile(record)])
      })
      .catch((reason) => setHandoffError(reason instanceof Error ? reason.message : pick("无法读取上一步的图片队列。", "Unable to read the image queue from the previous tool.")))
  }, [pick])

  return (
    <div className="space-y-4">
      {handoffError ? <Alert variant="destructive"><AlertTitle>{pick("无法继续上一步", "Unable to continue from the previous step")}</AlertTitle><AlertDescription>{handoffError}</AlertDescription></Alert> : null}
      <ImageDeliveryStudio initialFiles={initialFiles} />
    </div>
  )
}
