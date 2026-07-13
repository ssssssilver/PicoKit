"use client"

import type { ReactNode } from "react"

import { useLanguage } from "@/components/language-provider"

export function Localized({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  const { language } = useLanguage()
  return language === "en" ? en : zh
}
