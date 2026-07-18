"use client"

import { usePathname } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import {
  appShellDirection,
  defaultLanguage,
  detectLanguage,
  directionForLanguage,
  interpolateMessage,
  isLanguage,
  languageStorageKey,
  legacyLanguageStorageKey,
  resolveLocalized,
  translateEnglish,
  type Language,
  type TranslationMap,
} from "@/lib/i18n"
import { loadTranslations, needsTranslation } from "@/lib/locales"

type MessageValues = Record<string, string | number>

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  pick: (zh: string, en: string) => string
  format: (zh: string, en: string, values: MessageValues) => string
  translate: (en: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const pathname = usePathname()
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? defaultLanguage)
  const [translationState, setTranslationState] = useState<{ language: Language; messages: TranslationMap }>()
  const translations = translationState?.language === language ? translationState.messages : undefined

  const applyLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(languageStorageKey, nextLanguage)
    document.cookie = `${languageStorageKey}=${encodeURIComponent(nextLanguage)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(languageStorageKey) ?? window.localStorage.getItem(legacyLanguageStorageKey)
    const detected = detectLanguage(navigator.languages)
    const timer = window.setTimeout(() => applyLanguage(isLanguage(stored) ? stored : initialLanguage ?? detected), 0)
    return () => window.clearTimeout(timer)
  }, [applyLanguage, initialLanguage])

  useEffect(() => {
    let active = true
    if (!needsTranslation(language)) {
      return () => { active = false }
    }

    void loadTranslations(language).then((messages) => {
      if (active) setTranslationState({ language, messages })
    })
    return () => { active = false }
  }, [language])

  const pick = useCallback((zh: string, en: string) => (
    resolveLocalized({ zh, en }, language, translations)
  ), [language, translations])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = appShellDirection
    document.documentElement.dataset.language = language
    document.documentElement.dataset.textDirection = directionForLanguage(language)
    document.title = `${titleFor(pathname, language, translations)} | TabNative`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) {
      description.content = pick(
        "从原图到可发布成品，全程在浏览器本地处理；批量优化图片、检查 AI 来源证据、整理 PDF，无需登录或上传文件。",
        "Take files from source to ready-to-publish entirely in your browser: optimize images in batches, inspect AI provenance evidence, and organize PDFs without an account or uploads.",
      )
    }
  }, [language, pathname, pick, translations])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: applyLanguage,
    pick,
    format: (zh, en, values) => interpolateMessage(pick(zh, en), values),
    translate: (en) => translateEnglish(en, language, translations),
  }), [applyLanguage, language, pick, translations])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

function titleFor(pathname: string, language: Language, translations?: TranslationMap) {
  const titles: Record<string, [string, string]> = {
    "/": ["本地图片处理、AI 来源检查与 PDF 工具", "Local image workflows, AI provenance checks, and PDF tools"],
    "/ai-tools": ["按任务分类的 AI 工具导航", "AI Tools Directory by Task"],
    "/blog": ["工具使用教程", "Tool Guides and Tutorials"],
    "/ai-text-detector": ["免费 AI 文本检测", "Free AI Text Detector"],
    "/ai-image-detector": ["AI 图片来源证据检查", "AI Image Provenance Check"],
    "/image-metadata-checker": ["AI 图片来源与 C2PA 检查", "AI Image Provenance and C2PA Check"],
    "/gemini-watermark-remover": ["AI 可见水印处理", "Visible AI Watermark Tool"],
    "/ai-watermark-remover": ["AI 可见水印处理", "Visible AI Watermark Tool"],
    "/remove-ai-metadata-from-image": ["清理图片 AI 元数据", "Remove AI Metadata from Images"],
    "/remove-c2pa-content-credentials": ["清理 C2PA Content Credentials", "Remove C2PA Content Credentials"],
    "/remove-made-with-ai-label": ["清理 Made with AI 标签信号", "Remove Made with AI Label Signals"],
    "/remove-background": ["图片交付流水线：批量去背景", "Image Delivery Pipeline: Background Removal"],
    "/image-compressor": ["批量图片优化与交付", "Batch Image Optimization and Delivery"],
    "/image-editor": ["批量快速修图、标注与打码", "Batch Quick Image Editing, Annotation, and Redaction"],
    "/image-wobble-maker": ["图片晃动动画", "Image Wobble Animator"],
    "/resize-image-to-kb": ["把图片压缩到指定大小", "Compress an Image to a Target File Size"],
    "/3d-model-converter": ["3D 模型格式转换与预览", "3D Model Converter and Viewer"],
    "/pdf-tools": ["PDF 页面装配台", "PDF Page Assembly"],
    "/qr-code-tool": ["二维码生成与识别", "Generate and Decode QR Codes"],
    "/text-tools": ["文本统计、清理与编解码", "Count, Clean, Encode, and Decode Text"],
    "/json-tools": ["JSON 格式化、校验与转换", "Format, Validate, and Convert JSON"],
    "/file-hash-base64": ["文件校验与 Base64", "File Checksums and Base64"],
    "/favicon-generator": ["Favicon 与应用图标生成器", "Favicon and App Icon Generator"],
    "/markdown-editor": ["Markdown 编辑、预览与导出", "Edit, Preview, and Export Markdown"],
    "/spreadsheet-converter": ["表格预览与转换", "Preview and Convert Spreadsheets"],
    "/gif-tools": ["GIF 拆帧与合成", "Extract and Create GIFs"],
    "/audio-tools": ["音频裁剪与 WAV 导出", "Trim Audio and Export WAV"],
    "/video-tools": ["视频取帧与静音片段", "Video Frames and Muted Clips"],
    "/password-uuid-generator": ["密码与 UUID 生成器", "Password and UUID Generator"],
    "/date-time-tools": ["日期、时间戳与时区工具", "Date, Timestamp, and Time-zone Tools"],
    "/unit-ratio-converter": ["单位转换与宽高比计算", "Unit Converter and Aspect-ratio Calculator"],
    "/color-tools": ["颜色、调色板与对比度工具", "Color, Palette, and Contrast Tools"],
    "/regex-url-tools": ["正则表达式与 URL 工具", "Regex and URL Tools"],
    "/svg-tools": ["SVG 编辑、压缩与 PNG 导出", "Edit, Minify, and Export SVG"],
    "/avatar-emoji-generator": ["头像与团队表情生成器", "Avatar and Team Emoji Generator"],
    "/random-picker": ["随机抽取与公平分组", "Random Picker and Fair Grouping"],
    "/timer-tools": ["倒计时、番茄钟与秒表", "Countdown, Pomodoro, and Stopwatch"],
    "/screen-recorder": ["屏幕、窗口与标签页录制", "Screen, Window, and Tab Recorder"],
    "/methodology": ["检测与处理方法", "Methods and Limitations"],
    "/privacy": ["隐私说明", "Privacy"],
    "/licenses": ["开源许可证", "Open-source Licenses"],
    "/terms": ["使用条款", "Terms of Use"],
  }
  const pair = pathname.startsWith("/blog/") ? ["工具使用教程", "Tool Guide"] : titles[pathname] ?? ["TabNative", "TabNative"]
  return resolveLocalized({ zh: pair[0], en: pair[1] }, language, translations)
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider")
  return context
}
