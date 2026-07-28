import { CircleHelp, LockKeyhole } from "lucide-react"

import { DeviceCapability } from "@/components/device-capability"
import { Localized } from "@/components/localized"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LocalizedValue } from "@/lib/i18n"

export function ToolAside({ notes }: { notes: LocalizedValue[] }) {
  return (
    <>
      <DeviceCapability />
      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><LockKeyhole className="size-4 text-cyan-300" /><Localized zh="文件不上传" en="Privacy guarantee" /></CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-6 text-zinc-500"><Localized zh="文件只在当前浏览器中处理，TabNative 不会读取或保存原文件和处理结果；广告也无法访问处理中的文件。" en="Tools never send file contents to the TabNative server. Component boundaries isolate advertising from processing areas." /></p></CardContent>
      </Card>
      <Card className="border-white/10 bg-[#111] shadow-none">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CircleHelp className="size-4 text-cyan-300" /><Localized zh="使用提示" en="Tips" /></CardTitle></CardHeader>
        <CardContent><ul className="space-y-2 text-sm leading-6 text-zinc-500">{notes.map((note) => <li key={typeof note === "string" ? note : note.zh} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300" />{typeof note === "string" ? note : <Localized zh={note.zh} en={note.en} />}</li>)}</ul></CardContent>
      </Card>
    </>
  )
}
