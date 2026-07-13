import { CircleHelp, LockKeyhole } from "lucide-react"

import { AdSlot } from "@/components/ad-slot"
import { DeviceCapability } from "@/components/device-capability"
import { Localized } from "@/components/localized"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LocalizedValue } from "@/lib/i18n"

export function ToolAside({ notes }: { notes: LocalizedValue[] }) {
  return (
    <>
      <DeviceCapability />
      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><LockKeyhole className="size-4 text-cyan-300" /><Localized zh="隐私保证" en="Privacy guarantee" /></CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-6 text-zinc-500"><Localized zh="工具不会把文件内容发送到 PicoKit 服务端。广告区域与处理区域通过组件边界隔离。" en="Tools never send file contents to the PicoKit server. Component boundaries isolate advertising from processing areas." /></p></CardContent>
      </Card>
      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CircleHelp className="size-4 text-cyan-300" /><Localized zh="使用提示" en="Tips" /></CardTitle></CardHeader>
        <CardContent><ul className="space-y-2 text-sm leading-6 text-zinc-500">{notes.map((note) => <li key={typeof note === "string" ? note : note.zh} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300" />{typeof note === "string" ? note : <Localized zh={note.zh} en={note.en} />}</li>)}</ul></CardContent>
      </Card>
      <AdSlot className="min-h-64" label="侧栏广告位" labelEn="Sidebar ad" />
    </>
  )
}
