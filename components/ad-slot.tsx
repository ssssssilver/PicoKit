import { cn } from "@/lib/utils"

export function AdSlot({ className, label = "广告位" }: { className?: string; label?: string }) {
  return (
    <aside
      className={cn("flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-[0.18em] text-slate-400", className)}
      aria-label={label}
      data-ad-boundary="no-user-content"
    >
      {label}
    </aside>
  )
}

