import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const readLocale = (locale: string) => JSON.parse(
  readFileSync(new URL(`../lib/locales/${locale}.json`, import.meta.url), "utf8"),
) as Record<string, string>

describe("localized interface copy", () => {
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
