import type { Metadata } from "next"
import { Scissors } from "lucide-react"

import { BackgroundRemoverTool } from "@/components/background-remover-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费在线移除图片背景",
  description: "在浏览器本地移除人像背景并导出透明 PNG；无需登录，不上传图片。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "一键移除图片背景", en: "Remove Image Backgrounds" }}
    description={{ zh: "最适合主体清晰的单人半身或全身人像。处理在浏览器本地完成，可直接导出透明 PNG，图片不会上传。", en: "Best for clear single-person half-body or full-body portraits. Processing stays in your browser and exports a transparent PNG without uploading your image." }}
    eyebrow="On-device RemoveBG"
    icon={Scissors}
    aside={<ToolAside notes={[
      { zh: "最适合单人、前景清晰的人像照片", en: "Works best on clear, single-person portraits" },
      { zh: "商品、动物和复杂多主体场景可能不准确", en: "Products, animals, and complex multi-subject scenes may be inaccurate" },
      { zh: "首选 WebGPU，不支持时自动回退 WASM", en: "Prefers WebGPU and automatically falls back to WASM" },
    ]} />}
  ><BackgroundRemoverTool /></ToolShell>
}
