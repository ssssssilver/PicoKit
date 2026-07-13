import { CircleHelp, LockKeyhole } from "lucide-react"

import { AdSlot } from "@/components/ad-slot"
import { DeviceCapability } from "@/components/device-capability"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ToolAside({ notes }: { notes: string[] }) {
  return (
    <>
      <DeviceCapability />
      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><LockKeyhole className="size-4 text-cyan-700" />隐私保证</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-6 text-slate-500">工具不会把文件内容发送到 LocalProof 服务端。广告区域与处理区域通过组件边界隔离。</p></CardContent>
      </Card>
      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CircleHelp className="size-4 text-cyan-700" />使用提示</CardTitle></CardHeader>
        <CardContent><ul className="space-y-2 text-sm leading-6 text-slate-500">{notes.map((note) => <li key={note} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-500" />{note}</li>)}</ul></CardContent>
      </Card>
      <AdSlot className="min-h-64" label="侧栏广告位" />
    </>
  )
}

