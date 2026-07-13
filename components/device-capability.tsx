"use client"

import { Cpu, Gauge, MemoryStick, Zap } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Capability = {
  webgpu: boolean
  cores: number
  memory?: number
  backend: string
}

export function DeviceCapability() {
  const [capability, setCapability] = useState<Capability | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nav = navigator as Navigator & { gpu?: unknown; deviceMemory?: number }
      const webgpu = Boolean(nav.gpu)
      setCapability({ webgpu, cores: nav.hardwareConcurrency || 1, memory: nav.deviceMemory, backend: webgpu ? "WebGPU 优先" : "WASM 回退" })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><Gauge className="size-4 text-cyan-700" /> 当前设备</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><Zap className="size-4" /> 推理后端</span><Badge variant="secondary">{capability?.backend ?? "检测中"}</Badge></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><Cpu className="size-4" /> CPU 线程</span><span className="font-medium">{capability?.cores ?? "—"}</span></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><MemoryStick className="size-4" /> 设备内存</span><span className="font-medium">{capability?.memory ? `${capability.memory} GB` : "浏览器未公开"}</span></div>
      </CardContent>
    </Card>
  )
}
