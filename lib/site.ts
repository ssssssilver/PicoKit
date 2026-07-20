import type { LucideIcon } from "lucide-react"
import {
  Bot,
  Box,
  AudioLines,
  Braces,
  CalendarClock,
  Clapperboard,
  FileCode2,
  FileImage,
  FileKey2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Film,
  Gauge,
  ImageDown,
  ImageIcon,
  KeyRound,
  MonitorUp,
  Palette,
  QrCode,
  Regex,
  Ruler,
  Scissors,
  ScanSearch,
  ShieldCheck,
  Shuffle,
  Smile,
  Sparkles,
  Timer,
  Waves,
} from "lucide-react"

export const siteConfig = {
  name: "TabNative",
  tagline: "工具在标签页运行，文件留在你的设备上。",
  taglineEn: "Private tools, native to your browser.",
  description: "通过图片交付流水线与 PDF 页面装配台，在浏览器本地完成批量处理、逐页重组和成品交付；无需登录或上传文件。",
  descriptionEn: "Use the Image Delivery Pipeline and PDF Page Assembly to process batches, rebuild pages, and deliver finished files locally in your browser without accounts or uploads.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://tabnative.modone0622.workers.dev",
}

export const toolCategories = [
  { id: "ai", title: "AI 检测", titleEn: "AI detection", description: "检测英文文本与图片中的 AI 生成信号，并检查文件来源证据", descriptionEn: "Check English text and images for AI-generated signals and inspect file provenance" },
  { id: "image", title: "图片处理与交付", titleEn: "Image workflow", description: "批量优化、移除背景、快速修图并导出可发布图片", descriptionEn: "Batch-optimize, remove backgrounds, edit, and export ready-to-publish images" },
  { id: "privacy", title: "来源与隐私", titleEn: "Provenance & privacy", description: "检查和清理文件中的来源信息", descriptionEn: "Inspect and clean provenance information" },
  { id: "file", title: "文件与文档", titleEn: "Files & documents", description: "处理 PDF、表格、图标与本地文件", descriptionEn: "Work with PDFs, spreadsheets, icons, and local files" },
  { id: "media", title: "音视频", titleEn: "Audio & video", description: "处理 GIF、音频、视频画面与本地屏幕录制", descriptionEn: "Work with GIFs, audio, video frames, and local screen recordings" },
  { id: "text", title: "文本与开发工具", titleEn: "Text & developer tools", description: "处理文本、JSON、Markdown、二维码、日期、单位与开发任务", descriptionEn: "Work with text, JSON, Markdown, QR codes, dates, units, and developer tasks" },
  { id: "model", title: "3D 模型", titleEn: "3D models", description: "预览、检查并转换 3D 文件", descriptionEn: "Preview, inspect, and convert 3D files" },
] as const

export type ToolCategory = (typeof toolCategories)[number]["id"]

export type SiteTool = {
  href: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  icon: LucideIcon
  category: ToolCategory
  runtime?: string
  featured?: boolean
}

export const primaryTools: SiteTool[] = [
  {
    href: "/ai-text-detector",
    title: "AI 文本检测",
    titleEn: "AI Text Detector",
    description: "在当前设备分析英文文本，分段显示风险与不确定性。",
    descriptionEn: "Analyze English text on this device with segment-level risk and uncertainty.",
    icon: Bot,
    category: "ai",
    runtime: "WEBGPU / WASM",
    featured: true,
  },
  {
    href: "/ai-image-detector",
    title: "AI 图片检测",
    titleEn: "AI Image Provenance Check",
    description: "结合来源证据、平台标记与按需两级像素检测，弱结果自动复核。",
    descriptionEn: "Combine provenance, platform marks, and on-demand two-stage pixel checks with automatic review of weak results.",
    icon: ScanSearch,
    category: "ai",
    runtime: "BROWSER WORKER",
    featured: true,
  },
  {
    href: "/gemini-watermark-remover",
    title: "AI 可见水印处理",
    titleEn: "Visible AI Watermark Tool",
    description: "本地识别并处理 Gemini、豆包、即梦可见角标，也支持手动框选。",
    descriptionEn: "Locally process visible Gemini, Doubao, and Jimeng marks, with manual selection as a fallback.",
    icon: Sparkles,
    category: "image",
    runtime: "BROWSER WORKER",
    featured: true,
  },
]

export const utilityTools: SiteTool[] = [
  { href: "/3d-model-converter", title: "3D 模型转换与预览", titleEn: "3D Model Converter & Viewer", description: "本地预览 GLB、glTF、OBJ、FBX、STL、PLY，并导出常用交换格式。", descriptionEn: "Preview GLB, glTF, OBJ, FBX, STL, and PLY locally, then export common exchange formats.", icon: Box, category: "model", runtime: "WEBGL / BROWSER", featured: true },
  { href: "/remove-background", title: "图片交付流水线", titleEn: "Image Delivery Pipeline", description: "一次导入，连续完成批量去背景与修边、逐张快速修图、格式尺寸优化和打包交付。", descriptionEn: "Import once, then move the same batch through background removal, edge refinement, quick editing, optimization, and packaged delivery.", icon: Scissors, category: "image", runtime: "ONNX / CANVAS / WORKER", featured: true },
  { href: "/remove-ai-metadata-from-image", title: "清理 AI 元数据", titleEn: "Remove AI Metadata", description: "移除命中的生成器、工作流、提示词与 AI 来源字段。", descriptionEn: "Remove matched generator, workflow, prompt, and AI provenance fields.", icon: ShieldCheck, category: "privacy" },
  { href: "/remove-c2pa-content-credentials", title: "清理 C2PA", titleEn: "Remove C2PA", description: "删除 C2PA/JUMBF 容器并验证像素载荷保持一致。", descriptionEn: "Remove C2PA/JUMBF containers and verify the pixel payload stays unchanged.", icon: FileSearch, category: "privacy" },
  { href: "/remove-made-with-ai-label", title: "清理 AI 标签信号", titleEn: "Remove AI Label Signals", description: "选择性清理 DigitalSourceType 与 Made with AI 触发字段。", descriptionEn: "Selectively remove DigitalSourceType and Made with AI metadata triggers.", icon: FileImage, category: "privacy" },
  { href: "/image-compressor", title: "批量图片优化与交付", titleEn: "Batch Image Optimizer", description: "批量调整格式、尺寸、质量与目标大小，并统一命名或打包下载。", descriptionEn: "Batch-adjust format, dimensions, quality, and target size, then rename or download results together.", icon: ImageDown, category: "image", runtime: "CANVAS / WORKER", featured: true },
  { href: "/image-editor", title: "批量快速修图与标注", titleEn: "Batch Quick Image Editor", description: "多图逐张修图并保存最新版本，再整批接力到图片优化。", descriptionEn: "Edit images one by one, save their latest versions, then pass the full batch to image optimization.", icon: ImageIcon, category: "image", runtime: "FABRIC.JS / CANVAS", featured: true },
  { href: "/image-wobble-maker", title: "图片晃动动画", titleEn: "Image Wobble Animator", description: "涂抹需要运动的区域，实时预览弹性晃动并在本地导出 GIF 或视频。", descriptionEn: "Paint the areas that should move, preview elastic wobble, and export a GIF or video locally.", icon: Waves, category: "image", runtime: "CANVAS / MEDIARECORDER", featured: true },
  { href: "/resize-image-to-kb", title: "压缩到目标大小", titleEn: "Target-size Image Compressor", description: "搜索合适的尺寸与编码质量，尽量不超过目标文件大小。", descriptionEn: "Find a combination of dimensions and encoding quality that stays under a target file size.", icon: Gauge, category: "image" },
  { href: "/color-tools", title: "颜色与调色板", titleEn: "Color & Palette Tools", description: "转换颜色格式、检查对比度，并从图片提取主要颜色。", descriptionEn: "Convert color formats, check contrast, and extract dominant image colors.", icon: Palette, category: "image" },
  { href: "/svg-tools", title: "SVG 编辑与导出", titleEn: "SVG Toolkit", description: "格式化、压缩并安全预览 SVG，导出 SVG 或 PNG。", descriptionEn: "Format, minify, and safely preview SVGs, then export SVG or PNG.", icon: FileCode2, category: "image" },
  { href: "/avatar-emoji-generator", title: "头像与表情生成", titleEn: "Avatar & Emoji Generator", description: "用短文字或本地图片生成常用尺寸的静态头像和团队表情。", descriptionEn: "Create static avatars and team emoji from short text or a local image.", icon: Smile, category: "image" },
  { href: "/pdf-tools", title: "PDF 页面装配台", titleEn: "PDF Page Assembly", description: "汇入多个 PDF，逐页预览和重组，统一纸张、页码、水印与压缩，再合并、拆分或转换交付。", descriptionEn: "Bring multiple PDFs into one page assembly, preview and rebuild them, standardize output, then merge, split, or convert for delivery.", icon: FileText, category: "file", runtime: "PDF.JS / WORKER", featured: true },
  { href: "/favicon-generator", title: "Favicon 图标生成", titleEn: "Favicon Generator", description: "生成 ICO、PWA 图标、Apple Touch Icon 与 Manifest。", descriptionEn: "Create ICO, PWA icons, Apple Touch Icons, and a manifest.", icon: ImageIcon, category: "file" },
  { href: "/spreadsheet-converter", title: "表格转换", titleEn: "Spreadsheet Converter", description: "预览 XLSX、CSV、TSV 并导出 CSV、JSON 或 XLSX。", descriptionEn: "Preview XLSX, CSV, and TSV files and export CSV, JSON, or XLSX.", icon: FileSpreadsheet, category: "file", runtime: "SHEETJS / BROWSER" },
  { href: "/file-hash-base64", title: "文件校验与 Base64", titleEn: "File Checksums & Base64", description: "计算 SHA-256、SHA-1、MD5，或转换 Base64/Data URL。", descriptionEn: "Calculate SHA-256, SHA-1, and MD5, or convert Base64/Data URLs.", icon: FileKey2, category: "privacy" },
  { href: "/text-tools", title: "文本工作台", titleEn: "Text Workbench", description: "统计、去重、排序、编解码并比较文本差异。", descriptionEn: "Count, dedupe, sort, encode, and compare text.", icon: FileCode2, category: "text" },
  { href: "/json-tools", title: "JSON 工具箱", titleEn: "JSON Toolkit", description: "格式化、校验、查询 JSON，并转换 CSV。", descriptionEn: "Format, validate, and query JSON, then convert it to CSV.", icon: Braces, category: "text" },
  { href: "/markdown-editor", title: "Markdown 编辑器", titleEn: "Markdown Editor", description: "安全预览 Markdown，并导出 MD 或 HTML。", descriptionEn: "Safely preview Markdown and export MD or HTML.", icon: FileCode2, category: "text" },
  { href: "/qr-code-tool", title: "二维码生成与识别", titleEn: "QR Code Toolkit", description: "生成二维码并从本地图片识别内容。", descriptionEn: "Generate QR codes and decode them from local images.", icon: QrCode, category: "text" },
  { href: "/password-uuid-generator", title: "密码与 UUID 生成", titleEn: "Password & UUID Generator", description: "使用 Web Crypto 生成安全随机密码与批量 UUID v4。", descriptionEn: "Generate secure random passwords and bulk UUID v4 values with Web Crypto.", icon: KeyRound, category: "text" },
  { href: "/date-time-tools", title: "日期与时间工具", titleEn: "Date & Time Tools", description: "转换时间戳和时区，并计算日期间隔与精确年龄。", descriptionEn: "Convert timestamps and time zones, and calculate durations and exact ages.", icon: CalendarClock, category: "text" },
  { href: "/unit-ratio-converter", title: "单位与宽高比", titleEn: "Unit & Aspect-ratio Tools", description: "转换常用单位，并计算图片比例与等比尺寸。", descriptionEn: "Convert common units and calculate image ratios and proportional sizes.", icon: Ruler, category: "text" },
  { href: "/regex-url-tools", title: "正则与 URL 工具", titleEn: "Regex & URL Tools", description: "限时测试正则表达式，完成 URL 编解码与参数解析。", descriptionEn: "Test regex safely and encode, decode, or inspect URLs.", icon: Regex, category: "text" },
  { href: "/random-picker", title: "随机抽取与分组", titleEn: "Random Picker & Groups", description: "从本地名单安全随机抽取，或打乱后平均分组。", descriptionEn: "Securely pick from a local list or shuffle it into balanced groups.", icon: Shuffle, category: "text" },
  { href: "/timer-tools", title: "计时器与番茄钟", titleEn: "Timer & Pomodoro", description: "使用倒计时、番茄钟和秒表，并在当前浏览器保存完成记录。", descriptionEn: "Use countdown, Pomodoro, and stopwatch modes with local completion history.", icon: Timer, category: "text" },
  { href: "/gif-tools", title: "GIF 工具", titleEn: "GIF Toolkit", description: "把 GIF 拆成 PNG 帧，或将图片合成为动画。", descriptionEn: "Extract GIFs into PNG frames or combine images into animations.", icon: Film, category: "media" },
  { href: "/audio-tools", title: "音频裁剪", titleEn: "Audio Trimmer", description: "裁剪、调音量、淡入淡出并导出 WAV。", descriptionEn: "Trim, adjust volume, fade, and export WAV audio.", icon: AudioLines, category: "media" },
  { href: "/video-tools", title: "视频取帧与片段", titleEn: "Video Frame & Clip Tools", description: "导出视频帧、旋转并生成短静音 WebM。", descriptionEn: "Export video frames, rotate, and create short muted WebM clips.", icon: Clapperboard, category: "media" },
  { href: "/screen-recorder", title: "屏幕录制", titleEn: "Screen Recorder", description: "通过浏览器授权录制屏幕、窗口或标签页，并在本地下载。", descriptionEn: "Record a screen, window, or tab with browser permission and download locally.", icon: MonitorUp, category: "media" },
]

export const allTools = [...primaryTools, ...utilityTools]

export const commonToolHrefs = [
  "/remove-background",
  "/ai-image-detector",
  "/image-compressor",
  "/image-editor",
  "/image-wobble-maker",
  "/resize-image-to-kb",
  "/pdf-tools",
  "/ai-text-detector",
  "/qr-code-tool",
] as const

export const commonTools = commonToolHrefs.map((href) => allTools.find((tool) => tool.href === href)!)

export function getCategory(id: ToolCategory) {
  return toolCategories.find((category) => category.id === id)!
}
