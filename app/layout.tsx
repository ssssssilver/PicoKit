import type { Metadata } from "next"
import type { ReactNode } from "react"

import "./globals.css"

import { siteConfig } from "@/lib/site"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: "LocalProof — 本地 AI Detector", template: "%s | LocalProof" },
  description: siteConfig.description,
  applicationName: "LocalProof",
  keywords: ["AI detector", "AI 检测", "C2PA", "AI metadata", "Gemini watermark remover", "local image tools"],
  openGraph: { title: "LocalProof", description: siteConfig.description, type: "website", locale: "zh_CN", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "LocalProof — AI 证据留在本地" }] },
  twitter: { card: "summary_large_image", title: "LocalProof", description: siteConfig.description, images: ["/og.png"] },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>
}
