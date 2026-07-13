"use client"

import { useLanguage } from "@/components/language-provider"
import { cn } from "@/lib/utils"

export function AdSlot({ className, label = "广告位", labelEn = "Advertisement" }: { className?: string; label?: string; labelEn?: string }) {
  const { pick } = useLanguage()
  const localizedLabel = pick(label, labelEn)
  return (
    <aside
      className={cn("flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[.018] text-[10px] uppercase tracking-[0.18em] text-zinc-700", className)}
      aria-label={localizedLabel}
      data-ad-boundary="no-user-content"
    >
      {localizedLabel}
    </aside>
  )
}
