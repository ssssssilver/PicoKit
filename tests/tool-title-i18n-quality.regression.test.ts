import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const readLocale = (locale: string) => JSON.parse(
  readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url), "utf8"),
) as Record<string, string>

const expected: Record<string, Record<string, string>> = {
  ar: {
    "File Checksums & Base64": "التحقق من الملفات وBase64",
    "Format, Validate, and Convert JSON": "تنسيق JSON والتحقق من صحته وتحويله",
    "JSON Toolkit": "أدوات JSON",
  },
  de: {
    "Batch Quick Image Editor": "Schneller Stapel-Bildeditor",
    "Markdown Editor": "Markdown-Editor",
  },
  es: {
    "JSON Toolkit": "Kit de herramientas JSON",
    "Markdown Editor": "Editor de Markdown",
  },
  fr: {
    "Markdown Editor": "Éditeur Markdown",
    "Regex & URL Tools": "Outils Regex et URL",
  },
  id: {
    "GIF Toolkit": "Toolkit GIF",
    "Private PDF Organizer": "Pengelola PDF Privat",
  },
  ja: {
    "Edit, Preview, and Export Markdown": "Markdown を編集・プレビュー・書き出し",
    "Markdown Editor": "Markdown エディター",
    "Private PDF Organizer": "プライベート PDF 整理ツール",
  },
  ko: {
    "Markdown Editor": "Markdown 편집기",
    "Organize, Merge, and Convert PDFs": "PDF 정리, 병합 및 변환",
    "Private PDF Organizer": "비공개 PDF 정리 도구",
  },
  pl: {
    "Batch Quick Image Editor": "Szybki edytor obrazów wsadowych",
    "How to use {name}": "Jak korzystać z narzędzia „{name}”",
    "JSON Toolkit": "Narzędzia JSON",
  },
  ru: {
    "JSON Toolkit": "Инструменты JSON",
    "Private PDF Organizer": "Локальный органайзер PDF",
  },
  tr: {
    "Batch Image Optimizer": "Toplu Görsel Optimizasyonu",
    "Open GitHub repository": "GitHub deposunu aç",
  },
}

describe("high-visibility localized tool names", () => {
  it("uses direct product-language labels instead of literal or untranslated names", () => {
    for (const [locale, messages] of Object.entries(expected)) {
      expect(readLocale(locale)).toMatchObject(messages)
    }
  })
})
