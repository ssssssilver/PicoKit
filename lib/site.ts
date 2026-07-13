import {
  Bot,
  FileImage,
  FileSearch,
  Gauge,
  ImageDown,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

export const siteConfig = {
  name: "LocalProof",
  description: "免费的本地 AI 检测、来源检查与图片隐私工具。无需登录，文件不上传。",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
}

export const primaryTools = [
  {
    href: "/ai-text-detector",
    title: "AI 文本检测",
    description: "在设备上运行 ONNX 模型，分段显示风险与不确定性。",
    icon: Bot,
    accent: "indigo",
  },
  {
    href: "/ai-image-detector",
    title: "AI 图片来源检查",
    description: "检查 C2PA、EXIF、XMP、生成器参数和 AI 来源信号。",
    icon: ScanSearch,
    accent: "cyan",
  },
  {
    href: "/gemini-watermark-remover",
    title: "Gemini 水印处理",
    description: "用反向 Alpha 混合处理受支持的 Gemini 可见角标。",
    icon: Sparkles,
    accent: "violet",
  },
]

export const utilityTools = [
  { href: "/remove-ai-metadata-from-image", title: "清理 AI 元数据", icon: ShieldCheck },
  { href: "/remove-c2pa-content-credentials", title: "清理 C2PA", icon: FileSearch },
  { href: "/remove-made-with-ai-label", title: "清理 AI 标签信号", icon: FileImage },
  { href: "/image-compressor", title: "图片压缩转换", icon: ImageDown },
  { href: "/resize-image-to-kb", title: "压缩到目标 KB", icon: Gauge },
]

export const allTools = [...primaryTools, ...utilityTools]
