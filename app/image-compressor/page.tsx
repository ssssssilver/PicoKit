import type { Metadata } from "next"
import { ImageDown } from "lucide-react"

import { ImageCompressorTool } from "@/components/image-compressor-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费本地图片压缩与格式转换", description: "在浏览器本地压缩、缩放、裁切、旋转并转换 JPG、PNG、WebP，不上传图片。" }

export default function Page() { return <ToolShell title={{ zh: "图片压缩、裁切与转换", en: "Compress, Crop, and Convert Images" }} description={{ zh: "使用浏览器 Canvas Worker 完成 JPG、PNG、WebP 的格式转换、最大边缩放、居中比例裁切和旋转。", en: "Use a browser Canvas Worker to convert JPG, PNG, and WebP, resize the longest edge, apply centered aspect crops, and rotate images." }} eyebrow="Local Image Compressor" icon={ImageDown} aside={<ToolAside notes={[{ zh: "JPG/WebP 支持质量调整", en: "JPG and WebP support quality adjustment" }, { zh: "透明图片转 JPG 时使用白底", en: "Transparent images use a white background when converted to JPG" }, { zh: "超大图会先检查浏览器内存", en: "Very large images are checked against browser memory first" }]} />}><ImageCompressorTool /></ToolShell> }
