import type { Metadata } from "next"
import { Film } from "lucide-react"

import { GifTool } from "@/components/gif-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费 GIF 拆帧与图片合成 GIF", description: "本地把 GIF 拆成 PNG 帧 ZIP，或将多张图片合成为可循环 GIF。" }
export default function Page() { return <ToolShell title={{ zh: "GIF 拆帧与图片合成 GIF", en: "Extract GIF Frames and Create GIFs" }} description={{ zh: "把 GIF 导出成 PNG 帧 ZIP，或按选择顺序把多张图片合成为循环 GIF。", en: "Export a GIF as a ZIP of PNG frames, or combine images into a looping GIF in selection order." }} eyebrow="Local GIF Toolkit" icon={Film} aside={<ToolAside notes={[{ zh: "拆帧最多处理 300 帧", en: "Frame extraction is limited to 300 frames" }, { zh: "合成最多使用 100 张图片", en: "GIF creation supports up to 100 images" }, { zh: "照片类 GIF 可能出现色彩量化", en: "Photo GIFs may show color quantization" }]} />}><GifTool /></ToolShell> }
