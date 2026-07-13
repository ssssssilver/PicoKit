import type { MetadataRoute } from "next"

import { siteConfig } from "@/lib/site"

const routes = [
  "",
  "/ai-text-detector",
  "/ai-image-detector",
  "/image-metadata-checker",
  "/gemini-watermark-remover",
  "/ai-watermark-remover",
  "/remove-ai-metadata-from-image",
  "/remove-c2pa-content-credentials",
  "/remove-made-with-ai-label",
  "/image-compressor",
  "/resize-image-to-kb",
  "/methodology",
  "/privacy",
  "/licenses",
  "/terms",
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date("2026-07-13"),
    changeFrequency: route ? "monthly" : "weekly",
    priority: route ? 0.8 : 1,
  }))
}
