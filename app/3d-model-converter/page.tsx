import type { Metadata } from "next"
import { Box } from "lucide-react"

import { ModelConverterTool } from "@/components/model-converter-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "免费 3D 模型格式转换与在线预览",
  description: "在浏览器本地预览 GLB、glTF、OBJ、FBX、STL、PLY，并转换为 GLB、OBJ、STL 或 PLY；无需登录，不上传模型。",
}

export default function Page() {
  return <ToolShell
    title={{ zh: "3D 模型格式转换与预览", en: "3D Model Converter and Viewer" }}
    description={{
      zh: "直接在浏览器中打开、检查并转换常见 3D 模型。支持关联的 MTL、BIN 与贴图文件，模型内容不会上传到 TabNative。",
      en: "Open, inspect, and convert common 3D models directly in your browser. Related MTL, BIN, and texture files are supported, and model content is never uploaded to TabNative.",
    }}
    eyebrow="On-device 3D Toolkit"
    icon={Box}
    aside={<ToolAside notes={[
      { zh: "输入支持 GLB、glTF、OBJ、FBX、STL 与 PLY", en: "Accepts GLB, glTF, OBJ, FBX, STL, and PLY" },
      { zh: "GLB 最适合保留材质、贴图、层级与动画", en: "GLB is best for retaining materials, textures, hierarchy, and animation" },
      { zh: "OBJ、STL 与 PLY 主要用于几何交换，可能丢失场景信息", en: "OBJ, STL, and PLY focus on geometry and may omit scene information" },
      { zh: "复杂模型受当前设备显存和浏览器内存限制", en: "Complex models are limited by device graphics memory and browser memory" },
    ]} />}
  ><ModelConverterTool /></ToolShell>
}
