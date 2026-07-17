"use client"

import type { ReactNode } from "react"

import { useLanguage } from "@/components/language-provider"

export function Localized({ zh, en, values }: { zh: ReactNode; en: ReactNode; values?: Record<string, string | number> }) {
  const { language, pick, format } = useLanguage()
  if (typeof zh === "string" && typeof en === "string") return values ? format(zh, en, values) : pick(zh, en)
  return language === "zh-CN" ? zh : en
}

export function Translated({ zh, en }: { zh?: string; en: string }) {
  const { language, pick } = useLanguage()
  const value = pick(zh ?? en, en)
  const isEnglishFallback = language !== "zh-CN" && language !== "en" && value === en
  return <span lang={isEnglishFallback ? "en" : undefined}>{value}</span>
}
