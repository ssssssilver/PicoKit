import {
  Bot,
  FileImage,
  FileSearch,
  Gauge,
  ImageDown,
  Scissors,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

export const siteConfig = {
  name: "PicoKit",
  description: "免费的本地 AI 检测、来源检查与图片隐私工具。无需登录，文件不上传。",
  descriptionEn: "Free on-device AI detection, provenance checks, and image privacy tools. No account and no file uploads.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
}

export const primaryTools = [
  {
    href: "/ai-text-detector",
    title: "AI 文本检测",
    titleEn: "AI Text Detector",
    description: "在设备上运行 ONNX 模型，分段显示风险与不确定性。",
    descriptionEn: "Run an ONNX model on your device with segment-level risk and uncertainty.",
    icon: Bot,
    accent: "indigo",
  },
  {
    href: "/ai-image-detector",
    title: "AI 图片检测",
    titleEn: "AI Image Detector",
    description: "本地像素模型结合 C2PA、EXIF、XMP 与生成器来源证据。",
    descriptionEn: "Combine a local pixel model with C2PA, EXIF, XMP, and generator evidence.",
    icon: ScanSearch,
    accent: "cyan",
  },
  {
    href: "/gemini-watermark-remover",
    title: "Gemini 水印处理",
    titleEn: "Gemini Watermark Tool",
    description: "用反向 Alpha 混合处理受支持的 Gemini 可见角标。",
    descriptionEn: "Process supported visible Gemini marks with reverse alpha blending.",
    icon: Sparkles,
    accent: "violet",
  },
]

export const utilityTools = [
  { href: "/remove-background", title: "一键移除背景", titleEn: "Remove Background", description: "用本地 MODNet 模型生成人像 Alpha 蒙版并导出透明 PNG。", descriptionEn: "Use a local MODNet model to create a portrait alpha matte and export a transparent PNG.", icon: Scissors },
  { href: "/remove-ai-metadata-from-image", title: "清理 AI 元数据", titleEn: "Remove AI Metadata", description: "移除命中的生成器、工作流、提示词与 AI 来源字段。", descriptionEn: "Remove matched generator, workflow, prompt, and AI provenance fields.", icon: ShieldCheck },
  { href: "/remove-c2pa-content-credentials", title: "清理 C2PA", titleEn: "Remove C2PA", description: "删除 C2PA/JUMBF 容器并验证像素载荷保持一致。", descriptionEn: "Remove C2PA/JUMBF containers and verify the pixel payload stays unchanged.", icon: FileSearch },
  { href: "/remove-made-with-ai-label", title: "清理 AI 标签信号", titleEn: "Remove AI Label Signals", description: "选择性清理 DigitalSourceType 与 Made with AI 触发字段。", descriptionEn: "Selectively remove DigitalSourceType and Made with AI metadata triggers.", icon: FileImage },
  { href: "/image-compressor", title: "图片压缩转换", titleEn: "Image Compressor", description: "在浏览器中调整尺寸、格式、裁切比例与质量。", descriptionEn: "Resize, convert, crop, and tune image quality in your browser.", icon: ImageDown },
  { href: "/resize-image-to-kb", title: "压缩到目标 KB", titleEn: "Resize Image to KB", description: "搜索合适的尺寸与编码质量，尽量不超过目标大小。", descriptionEn: "Search for dimensions and encoding quality that stay under a target size.", icon: Gauge },
]

export const allTools = [...primaryTools, ...utilityTools]
