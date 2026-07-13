"use client"

import { Cpu, Gauge, MemoryStick, Zap } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/components/language-provider"

type Capability = {
  webgpu: boolean
  cores: number
  memory?: number
  backend: string
}

export function DeviceCapability() {
  const { pick } = useLanguage()
  const [capability, setCapability] = useState<Capability | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nav = navigator as Navigator & { gpu?: unknown; deviceMemory?: number }
      const webgpu = Boolean(nav.gpu)
      setCapability({ webgpu, cores: nav.hardwareConcurrency || 1, memory: nav.deviceMemory, backend: webgpu ? pick("WebGPU 优先", "WebGPU preferred") : pick("WASM 回退", "WASM fallback") })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pick])

  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><Gauge className="size-4 text-cyan-700" /> {pick("当前设备", "Current device")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><Zap className="size-4" /> {pick("推理后端", "Inference backend")}</span><Badge variant="secondary">{capability?.backend ?? pick("检测中", "Detecting")}</Badge></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><Cpu className="size-4" /> {pick("CPU 线程", "CPU threads")}</span><span className="font-medium">{capability?.cores ?? "—"}</span></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><MemoryStick className="size-4" /> {pick("设备内存", "Device memory")}</span><span className="font-medium">{capability?.memory ? `${capability.memory} GB` : pick("浏览器未公开", "Not exposed")}</span></div>
      </CardContent>
    </Card>
  )
}
