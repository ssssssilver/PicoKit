import type { Metadata } from "next"
import { cookies } from "next/headers"
import type { ReactNode } from "react"

import "./globals.css"

import { LanguageProvider } from "@/components/language-provider"
import { ImageWorkflowMemoryProvider } from "@/components/image-workflow-memory"
import { LocalAssetJanitor } from "@/components/local-asset-janitor"
import { ThemeProvider } from "@/components/theme-provider"
import { appShellDirection, defaultLanguage, directionForLanguage, isLanguage, languageStorageKey } from "@/lib/i18n"
import { siteConfig } from "@/lib/site"
import { defaultTheme, isTheme, themeStorageKey } from "@/lib/theme"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: "TabNative — 本地浏览器工具箱", template: "%s | TabNative" },
  description: siteConfig.description,
  applicationName: "TabNative",
  keywords: ["browser tools", "本地工具箱", "AI detector", "图片处理", "PDF 工具", "C2PA", "3D 模型转换", "密码生成器", "时间戳转换", "单位转换", "SVG 工具", "屏幕录制"],
  openGraph: { title: "TabNative", description: siteConfig.description, type: "website", locale: "zh_CN" },
  twitter: { card: "summary", title: "TabNative", description: siteConfig.description },
  robots: { index: true, follow: true },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const storedLanguage = cookieStore.get(languageStorageKey)?.value ?? null
  const initialLanguage = isLanguage(storedLanguage) ? storedLanguage : undefined
  const storedTheme = cookieStore.get(themeStorageKey)?.value ?? null
  const initialTheme = isTheme(storedTheme) ? storedTheme : defaultTheme
  const selectedLanguage = initialLanguage ?? defaultLanguage
  return (
    <html
      lang={selectedLanguage}
      dir={appShellDirection}
      className={initialTheme}
      data-theme={initialTheme}
      data-language={selectedLanguage}
      data-text-direction={directionForLanguage(selectedLanguage)}
    >
      <body>
        <ThemeProvider initialTheme={initialTheme}>
          <LanguageProvider initialLanguage={initialLanguage}>
            <ImageWorkflowMemoryProvider>
              <LocalAssetJanitor />
              {children}
            </ImageWorkflowMemoryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
