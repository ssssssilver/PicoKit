"use client"

import { usePathname } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { defaultLanguage, isLanguage, languageStorageKey, legacyLanguageStorageKey, type Language } from "@/lib/i18n"

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  pick: (zh: string, en: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [language, setLanguageState] = useState<Language>(defaultLanguage)

  const applyLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(languageStorageKey, nextLanguage)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(languageStorageKey) ?? window.localStorage.getItem(legacyLanguageStorageKey)
    const detected = navigator.languages.some((item) => item.toLowerCase().startsWith("zh")) ? "zh-CN" : "en"
    const timer = window.setTimeout(() => applyLanguage(isLanguage(stored) ? stored : detected), 0)
    return () => window.clearTimeout(timer)
  }, [applyLanguage])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.language = language
    document.title = `${titleFor(pathname, language)} | PicoKit`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = language === "en"
      ? "Free on-device AI detection, provenance checks, and image privacy tools. No account and no file uploads."
      : "免费的本地 AI 检测、来源检查与图片隐私工具。无需登录，文件不上传。"
  }, [language, pathname])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: applyLanguage,
    pick: (zh, en) => language === "en" ? en : zh,
  }), [applyLanguage, language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

function titleFor(pathname: string, language: Language) {
  const titles: Record<string, [string, string]> = {
    "/": ["免费本地 AI Detector 与图片隐私工具", "Free On-device AI Detector and Image Privacy Tools"],
    "/ai-text-detector": ["免费 AI 文本检测", "Free AI Text Detector"],
    "/ai-image-detector": ["AI 图片来源与 C2PA 检查", "AI Image Provenance and C2PA Check"],
    "/image-metadata-checker": ["AI 图片来源与 C2PA 检查", "AI Image Provenance and C2PA Check"],
    "/gemini-watermark-remover": ["Gemini 可见水印处理", "Gemini Visible Watermark Tool"],
    "/ai-watermark-remover": ["Gemini 可见水印处理", "Gemini Visible Watermark Tool"],
    "/remove-ai-metadata-from-image": ["清理图片 AI 元数据", "Remove AI Metadata from Images"],
    "/remove-c2pa-content-credentials": ["清理 C2PA Content Credentials", "Remove C2PA Content Credentials"],
    "/remove-made-with-ai-label": ["清理 Made with AI 标签信号", "Remove Made with AI Label Signals"],
    "/remove-background": ["一键移除图片背景", "Remove Image Backgrounds"],
    "/image-compressor": ["图片压缩与格式转换", "Image Compressor and Converter"],
    "/resize-image-to-kb": ["把图片压缩到指定 KB", "Resize Image to a Target KB"],
    "/methodology": ["检测与处理方法", "Methods and Limitations"],
    "/privacy": ["隐私说明", "Privacy"],
    "/licenses": ["开源许可证", "Open-source Licenses"],
    "/terms": ["使用条款", "Terms of Use"],
  }
  const pair = titles[pathname] ?? ["PicoKit", "PicoKit"]
  return language === "en" ? pair[1] : pair[0]
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider")
  return context
}
