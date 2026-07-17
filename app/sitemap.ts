import type { MetadataRoute } from "next"

import { siteConfig } from "@/lib/site"
import { toolGuides } from "@/lib/tool-guides"

const routes = [
  "",
  "/ai-tools",
  "/blog",
  ...toolGuides.map((guide) => `/blog/${guide.slug}`),
  "/ai-text-detector",
  "/ai-image-detector",
  "/gemini-watermark-remover",
  "/remove-ai-metadata-from-image",
  "/remove-c2pa-content-credentials",
  "/remove-made-with-ai-label",
  "/remove-background",
  "/image-compressor",
  "/image-editor",
  "/resize-image-to-kb",
  "/3d-model-converter",
  "/pdf-tools",
  "/qr-code-tool",
  "/text-tools",
  "/json-tools",
  "/file-hash-base64",
  "/favicon-generator",
  "/markdown-editor",
  "/spreadsheet-converter",
  "/gif-tools",
  "/audio-tools",
  "/video-tools",
  "/password-uuid-generator",
  "/date-time-tools",
  "/unit-ratio-converter",
  "/color-tools",
  "/regex-url-tools",
  "/svg-tools",
  "/avatar-emoji-generator",
  "/random-picker",
  "/timer-tools",
  "/screen-recorder",
  "/methodology",
  "/privacy",
  "/licenses",
  "/terms",
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date("2026-07-15"),
    changeFrequency: route ? "monthly" : "weekly",
    priority: route ? 0.8 : 1,
  }))
}
