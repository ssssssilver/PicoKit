import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const readLocale = (locale: string) => JSON.parse(
  readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url), "utf8"),
) as Record<string, string>

describe("localized interface copy", () => {
  it("does not translate CPU threads as topics or message threads", () => {
    const expected = {
      ar: "خيوط المعالج",
      de: "CPU-Threads",
      es: "Hilos de CPU",
      fr: "Threads du processeur",
      id: "Thread CPU",
      ja: "CPU スレッド",
      ko: "CPU 스레드",
      pl: "Wątki procesora",
      pt: "Threads da CPU",
      ru: "Потоки процессора",
      tr: "CPU iş parçacıkları",
    }

    for (const [locale, label] of Object.entries(expected)) {
      expect(readLocale(locale)["CPU threads"]).toBe(label)
    }
  })

  it("uses action verbs for common buttons instead of literal adjectives or acknowledgements", () => {
    expect(readLocale("ar")).toMatchObject({ Copy: "نسخ", Clear: "مسح", Remove: "إزالة" })
    expect(readLocale("de")).toMatchObject({ Clear: "Leeren" })
    expect(readLocale("fr")).toMatchObject({ Copy: "Copier", Clear: "Effacer", Remove: "Supprimer" })
    expect(readLocale("id")).toMatchObject({ Clear: "Bersihkan", "Open menu": "Buka menu" })
    expect(readLocale("ru")).toMatchObject({ Copy: "Копировать", Clear: "Очистить", Remove: "Удалить" })
    expect(readLocale("tr")).toMatchObject({ Clear: "Temizle", "Close menu": "Menüyü kapat" })
  })

  it("uses natural Korean labels for common controls", () => {
    expect(readLocale("ko")).toMatchObject({
      Characters: "글자",
      Licenses: "라이선스",
      "Local processing": "로컬 처리",
      "Switch to light mode": "라이트 모드로 전환",
      "TabNative home": "TabNative 홈",
    })
  })

  it("uses direct PDF workflow labels in tested locales", () => {
    expect(readLocale("ar")).toMatchObject({
      "Choose one PDF": "اختر ملف PDF",
      "Images to PDF": "تحويل الصور إلى PDF",
      "Merge PDFs": "دمج ملفات PDF",
      "PDF to images": "تحويل PDF إلى صور",
      "Process page ranges": "معالجة نطاقات الصفحات",
    })
    expect(readLocale("de")).toMatchObject({
      "Choose one PDF": "Eine PDF-Datei auswählen",
      "Images to PDF": "Bilder in PDF umwandeln",
      "Process page ranges": "Seitenbereiche verarbeiten",
    })
    expect(readLocale("es")).toMatchObject({
      "AI Text Detector": "Detector de texto generado por IA",
      "QR Code Toolkit": "Herramientas de códigos QR",
      "Process page ranges": "Procesar rangos de páginas",
    })
    expect(readLocale("ja")).toMatchObject({
      "Export organized PDF": "整理した PDF を書き出す",
      "Images to PDF": "画像を PDF に変換",
      "PDF to images": "PDF を画像に変換",
    })
  })
})
