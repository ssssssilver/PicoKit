"use client"

import { useState } from "react"

export function ImageCompare({ before, after, beforeLabel = "原图", afterLabel = "结果" }: { before: string; after: string; beforeLabel?: string; afterLabel?: string }) {
  const [position, setPosition] = useState(50)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#eef2f7_25%,transparent_25%),linear-gradient(-45deg,#eef2f7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eef2f7_75%),linear-gradient(-45deg,transparent_75%,#eef2f7_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0]">
      <div className="relative grid min-h-72 place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterLabel} className="max-h-[560px] w-full object-contain" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={beforeLabel} className="h-full w-full object-contain" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(15,23,42,.35)]" style={{ left: `${position}%` }} />
        <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-white">{beforeLabel}</span>
        <span className="absolute right-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-white">{afterLabel}</span>
        <input
          className="absolute inset-x-4 bottom-4 h-2 cursor-ew-resize accent-cyan-500"
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label="拖动比较原图和结果"
        />
      </div>
    </div>
  )
}

