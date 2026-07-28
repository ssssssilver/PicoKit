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
  WandSparkles,
  Waves,
} from "lucide-react"

export const siteConfig = {
  name: "TabNative",
  tagline: "打开网页就能用，文件不用上传。",
  taglineEn: "Private tools, native to your browser.",
  description: "免费在线工具箱，支持图片批量处理、PDF 合并拆分、二维码、音视频和常用开发工具；无需登录，文件不上传。",
  descriptionEn: "Batch-process images, organize PDF pages, and export finished files locally in your browser without accounts or uploads.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://tabnative.modone0622.workers.dev",
}

export const toolCategories = [
  { id: "ai", title: "AI 检测", titleEn: "AI detection", description: "检测图片或英文文本是否可能由 AI 生成", descriptionEn: "Check English text and images for AI-generated signals and inspect file provenance" },
  { id: "image", title: "图片处理", titleEn: "Image workflow", description: "去背景、修图、压缩、改尺寸和转换格式", descriptionEn: "Batch-optimize, remove backgrounds, edit, and export ready-to-publish images" },
  { id: "privacy", title: "图片信息与隐私", titleEn: "Provenance & privacy", description: "查看或清理图片中的元数据和来源信息", descriptionEn: "Inspect and clean provenance information" },
  { id: "file", title: "PDF 与文件", titleEn: "Files & documents", description: "合并拆分 PDF，转换表格、图标和常用文件", descriptionEn: "Work with PDFs, spreadsheets, icons, and local files" },
  { id: "media", title: "音视频", titleEn: "Audio & video", description: "处理 GIF、音频、视频画面和屏幕录制", descriptionEn: "Work with GIFs, audio, video frames, and local screen recordings" },
  { id: "text", title: "文本与实用工具", titleEn: "Text & developer tools", description: "文本、JSON、二维码、日期、单位和开发小工具", descriptionEn: "Work with text, JSON, Markdown, QR codes, dates, units, and developer tasks" },
  { id: "model", title: "3D 模型", titleEn: "3D models", description: "在线预览并转换常见 3D 模型格式", descriptionEn: "Preview, inspect, and convert 3D files" },
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
  hidden?: boolean
}

export const primaryTools: SiteTool[] = [
  {
    href: "/ai-text-detector",
    title: "AI 文本检测",
    titleEn: "AI Text Detector",
    description: "检测英文文本是否可能由 AI 生成，并按段落标出结果。",
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
    description: "上传图片后自动检测，直接判断是否可能由 AI 生成；图片不上传。",
    descriptionEn: "Combine provenance, platform marks, and on-demand two-stage pixel checks with automatic review of weak results.",
    icon: ScanSearch,
    category: "ai",
    runtime: "BROWSER WORKER",
  },
  {
    href: "/one-click-ai-cleaner",
    title: "清理 AI 图片标记",
    titleEn: "One-click AI Trace Cleaner",
    description: "清理支持的可见 AI 角标和相关元数据，再重新编码导出；不能保证通过所有平台检测。",
    descriptionEn: "Clean supported AI marks and provenance fields, then normalize image delivery with light resampling, sensor grain, and re-encoding.",
    icon: WandSparkles,
    category: "privacy",
    runtime: "CANVAS / BROWSER",
    featured: true,
  },
  {
    href: "/gemini-watermark-remover",
    title: "AI 图片水印去除",
    titleEn: "Visible AI Watermark Tool",
    description: "自动识别并去除 Gemini、豆包、即梦等可见角标，也可手动框选水印区域。",
    descriptionEn: "Locally process visible Gemini, Doubao, and Jimeng marks, with manual selection as a fallback.",
    icon: Sparkles,
    category: "image",
    runtime: "BROWSER WORKER",
    featured: true,
  },
]

export const utilityTools: SiteTool[] = [
  { href: "/3d-model-converter", title: "3D 模型转换与预览", titleEn: "3D Model Converter & Viewer", description: "在线预览 GLB、glTF、OBJ、FBX、STL、PLY，并转换为常用格式。", descriptionEn: "Preview GLB, glTF, OBJ, FBX, STL, and PLY locally, then export common exchange formats.", icon: Box, category: "model", runtime: "WEBGL / BROWSER", featured: true },
  { href: "/remove-background", title: "图片批量处理", titleEn: "Batch Image Processing", description: "一次添加最多 30 张图片，批量去背景、修图、改尺寸、压缩、转换格式并打包下载。", descriptionEn: "Import up to 30 images once, then remove backgrounds, make quick edits, convert, compress, and package downloads in one workspace.", icon: Scissors, category: "image", runtime: "ONNX / CANVAS / WORKER", featured: true },
  { href: "/remove-ai-metadata-from-image", title: "去除图片 AI 元数据", titleEn: "Remove AI Metadata", description: "删除图片中的 AI 生成器、工作流、提示词和来源字段。", descriptionEn: "Remove matched generator, workflow, prompt, and AI provenance fields.", icon: ShieldCheck, category: "privacy" },
  { href: "/remove-c2pa-content-credentials", title: "去除 C2PA 信息", titleEn: "Remove C2PA", description: "删除图片中的 C2PA 内容凭证，不改变画面内容。", descriptionEn: "Remove C2PA/JUMBF containers and verify the pixel payload stays unchanged.", icon: FileSearch, category: "privacy" },
  { href: "/remove-made-with-ai-label", title: "去除 Made with AI 信息", titleEn: "Remove AI Label Signals", description: "清理可能触发“Made with AI”标签的相关元数据。", descriptionEn: "Selectively remove DigitalSourceType and Made with AI metadata triggers.", icon: FileImage, category: "privacy" },
  { href: "/image-compressor", title: "批量图片压缩与转换", titleEn: "Batch Image Optimizer", description: "批量调整格式、尺寸、清晰度和目标大小，并统一命名或打包下载。", descriptionEn: "Batch-adjust format, dimensions, quality, and target size, then rename or download results together.", icon: ImageDown, category: "image", runtime: "CANVAS / WORKER", featured: true, hidden: true },
  { href: "/image-editor", title: "批量快速修图与标注", titleEn: "Batch Quick Image Editor", description: "多图逐张修图并保存最新版本，再整批接力到图片优化。", descriptionEn: "Edit images one by one, save their latest versions, then pass the full batch to image optimization.", icon: ImageIcon, category: "image", runtime: "FABRIC.JS / CANVAS", featured: true, hidden: true },
  { href: "/image-wobble-maker", title: "图片晃动动画", titleEn: "Image Wobble Animator", description: "涂抹想让它晃动的区域，实时预览效果并导出 GIF 或视频。", descriptionEn: "Paint the areas that should move, preview elastic wobble, and export a GIF or video locally.", icon: Waves, category: "image", runtime: "CANVAS / MEDIARECORDER", featured: true },
  { href: "/resize-image-to-kb", title: "图片压缩到指定 KB", titleEn: "Target-size Image Compressor", description: "输入想要的文件大小，自动调整尺寸和清晰度，尽量压到目标值以内。", descriptionEn: "Find a combination of dimensions and encoding quality that stays under a target file size.", icon: Gauge, category: "image" },
  { href: "/color-tools", title: "颜色与调色板", titleEn: "Color & Palette Tools", description: "转换颜色格式、检查对比度，并从图片提取主要颜色。", descriptionEn: "Convert color formats, check contrast, and extract dominant image colors.", icon: Palette, category: "image" },
  { href: "/svg-tools", title: "SVG 编辑与导出", titleEn: "SVG Toolkit", description: "格式化、压缩并安全预览 SVG，导出 SVG 或 PNG。", descriptionEn: "Format, minify, and safely preview SVGs, then export SVG or PNG.", icon: FileCode2, category: "image" },
  { href: "/avatar-emoji-generator", title: "头像与表情生成", titleEn: "Avatar & Emoji Generator", description: "用短文字或本地图片生成常用尺寸的静态头像和团队表情。", descriptionEn: "Create static avatars and team emoji from short text or a local image.", icon: Smile, category: "image" },
  { href: "/pdf-tools", title: "PDF 批量处理", titleEn: "Batch PDF Processing", description: "多个 PDF 合并、拆分、调顺序、旋转、删除或提取页面，也能加页码水印、压缩和转图片。", descriptionEn: "Bring multiple PDFs into one page assembly, preview and rebuild them, standardize output, then merge, split, or convert for delivery.", icon: FileText, category: "file", runtime: "PDF.JS / WORKER", featured: true },
  { href: "/favicon-generator", title: "Favicon 图标生成", titleEn: "Favicon Generator", description: "生成 ICO、PWA 图标、Apple Touch Icon 与 Manifest。", descriptionEn: "Create ICO, PWA icons, Apple Touch Icons, and a manifest.", icon: ImageIcon, category: "file" },
  { href: "/spreadsheet-converter", title: "表格转换", titleEn: "Spreadsheet Converter", description: "预览 XLSX、CSV、TSV 并导出 CSV、JSON 或 XLSX。", descriptionEn: "Preview XLSX, CSV, and TSV files and export CSV, JSON, or XLSX.", icon: FileSpreadsheet, category: "file", runtime: "SHEETJS / BROWSER" },
  { href: "/file-hash-base64", title: "文件校验与 Base64", titleEn: "File Checksums & Base64", description: "计算 SHA-256、SHA-1、MD5，或转换 Base64/Data URL。", descriptionEn: "Calculate SHA-256, SHA-1, and MD5, or convert Base64/Data URLs.", icon: FileKey2, category: "privacy" },
  { href: "/text-tools", title: "文本处理工具", titleEn: "Text Processing Tools", description: "统计字数，按行去重或排序，编解码并比较文本差异。", descriptionEn: "Count, dedupe, sort, encode, and compare text.", icon: FileCode2, category: "text" },
  { href: "/json-tools", title: "JSON 工具箱", titleEn: "JSON Toolkit", description: "格式化、校验、查询 JSON，并转换 CSV。", descriptionEn: "Format, validate, and query JSON, then convert it to CSV.", icon: Braces, category: "text" },
  { href: "/markdown-editor", title: "Markdown 编辑器", titleEn: "Markdown Editor", description: "安全预览 Markdown，并导出 MD 或 HTML。", descriptionEn: "Safely preview Markdown and export MD or HTML.", icon: FileCode2, category: "text" },
  { href: "/qr-code-tool", title: "二维码生成与识别", titleEn: "QR Code Toolkit", description: "输入文字或链接生成二维码，也能识别图片里的二维码内容。", descriptionEn: "Generate QR codes and decode them from local images.", icon: QrCode, category: "text" },
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
export const visibleTools = allTools.filter((tool) => !tool.hidden)

export const commonToolHrefs = [
  "/remove-background",
  "/ai-image-detector",
  "/image-wobble-maker",
  "/resize-image-to-kb",
  "/pdf-tools",
  "/ai-text-detector",
  "/qr-code-tool",
] as const

export const commonTools = commonToolHrefs.map((href) => visibleTools.find((tool) => tool.href === href)!)

export function getCategory(id: ToolCategory) {
  return toolCategories.find((category) => category.id === id)!
}
