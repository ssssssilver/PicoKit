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

  it("uses model-analysis terminology instead of human confidence or instruction-manual wording", () => {
    expect(readLocale("ar")).toMatchObject({ Manual: "يدوي", Confidence: "درجة الثقة" })
    expect(readLocale("de")).toMatchObject({ Manual: "Manuell", "Manual selection": "Manuelle Auswahl", Confidence: "Konfidenz" })
    expect(readLocale("es")).toMatchObject({ Manual: "Manual", Original: "Original", "Inference backend": "Motor de inferencia" })
    expect(readLocale("ja")).toMatchObject({ Manual: "手動", Confidence: "確信度", "Not identified": "未特定" })
    expect(readLocale("ko")).toMatchObject({ Manual: "수동", Confidence: "신뢰도", "Not identified": "식별되지 않음" })
    expect(readLocale("pl")).toMatchObject({ Manual: "Ręcznie", Confidence: "Poziom pewności" })
    expect(readLocale("pt")).toMatchObject({ Manual: "Manual", Original: "Original" })
    expect(readLocale("tr")).toMatchObject({ Confidence: "Güven düzeyi", "Not identified": "Belirlenemedi" })
  })

  it("keeps target-file-size copy free of database, keyboard, or knowledge mistranslations", () => {
    for (const locale of ["ar", "ja", "ko", "pl"]) {
      const messages = readLocale(locale)
      const relevant = Object.entries(messages)
        .filter(([key]) => /target.?KB|Target size \(KB\)/i.test(key))
        .map(([, value]) => value)
        .join(" ")
      expect(relevant).not.toMatch(/قاعدة بيانات|قاعدة المعلومات|كيبورد|ターゲット知識|目標知識|목표 지식|docelową baz|docelowej bazy|klawiatur/i)
    }
  })

  it("uses natural Japanese copy on the target-size result screen", () => {
    expect(readLocale("ja")).toMatchObject({
      "Target-size Image Compressor": "目標サイズ指定の画像圧縮",
      "Run target compression": "目標サイズに圧縮",
      Saved: "削減率",
    })
    expect(Object.values(readLocale("ja")).join(" ")).not.toMatch(/ランターゲット|PDF組織運営|アドバタイズメント|ターゲット知識/)
  })

  it("uses the visual-background meaning in French color and image tools", () => {
    expect(readLocale("fr")).toMatchObject({ Background: "Arrière-plan" })
  })

  it("uses natural French date and time labels", () => {
    expect(readLocale("fr")).toMatchObject({
      "Time input": "Saisie de la date ou de l’heure",
      "Use current time": "Utiliser l’heure actuelle",
      "Display time zone": "Fuseau horaire d’affichage",
      "Age on": "Date de calcul",
    })
  })

  it("uses the measurement meaning of area in the unit converter", () => {
    expect(readLocale("ar")).toMatchObject({ Area: "المساحة" })
    expect(readLocale("de")).toMatchObject({ Area: "Fläche" })
    expect(readLocale("id")).toMatchObject({ Area: "Luas" })
    expect(readLocale("ja")).toMatchObject({ Area: "面積" })
    expect(readLocale("pl")).toMatchObject({ Area: "Powierzchnia" })
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
