import type { Metadata } from "next"
import { QrCode } from "lucide-react"

import { QrTool } from "@/components/qr-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费二维码生成与识别", description: "本地生成网址、文本、Wi-Fi 二维码，导出 PNG/SVG，并从图片识别二维码。" }
export default function Page() { return <ToolShell title={{ zh: "二维码生成与识别", en: "Generate and Decode QR Codes" }} description={{ zh: "生成网址、文本、Wi-Fi、邮箱和电话二维码，或从图片识别二维码内容。", en: "Create QR codes for URLs, text, Wi-Fi, email, and phone numbers, or decode a QR code from an image." }} eyebrow="Local QR Toolkit" icon={QrCode} aside={<ToolAside notes={[{ zh: "支持 PNG 与 SVG 导出", en: "Export as PNG or SVG" }, { zh: "高容错级别更适合添加 Logo", en: "Higher error correction works better with logos" }, { zh: "识别过程不会上传图片", en: "Images stay on your device while decoding" }]} />}><QrTool /></ToolShell> }
