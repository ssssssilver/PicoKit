import type { Metadata } from "next"
import type { ReactNode } from "react"

import "./globals.css"

import { LanguageProvider } from "@/components/language-provider"
import { siteConfig } from "@/lib/site"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: "PicoKit — 本地 AI Detector", template: "%s | PicoKit" },
  description: siteConfig.description,
  applicationName: "PicoKit",
  keywords: ["AI detector", "AI 检测", "C2PA", "AI metadata", "Gemini watermark remover", "local image tools"],
  openGraph: { title: "PicoKit", description: siteConfig.description, type: "website", locale: "zh_CN" },
  twitter: { card: "summary", title: "PicoKit", description: siteConfig.description },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN" className="dark"><body><LanguageProvider>{children}</LanguageProvider></body></html>
}
