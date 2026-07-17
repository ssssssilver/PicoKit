import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import bingTranslateApi from "bing-translate-api"

const { MET } = bingTranslateApi

const targets = ["ja", "ko", "es", "pt", "id", "de", "pl", "ru", "fr", "ar", "tr"]
const roots = ["app", "components", "lib"]
const sourceKeys = extractEnglishKeys()

for (const value of [
  "Take files from source to ready-to-publish entirely in your browser: optimize images in batches, inspect AI provenance evidence, and organize PDFs without an account or uploads.",
  "Local image workflows, AI provenance checks, and PDF tools",
  "AI Image Provenance Check",
  "Batch Image Optimization and Delivery",
  "Private PDF Organization and Conversion",
  "Private tools, native to your browser. Work with images, PDFs, text, audio, video, and 3D models, or check AI-generated signals without signing in.",
  "Private tools in your browser",
  "AI Tools Directory by Task",
  "Free AI Text Detector",
  "Free AI Image Detector",
  "AI Image Provenance and C2PA Check",
  "Visible AI Watermark Tool",
  "Remove AI Metadata from Images",
  "Remove C2PA Content Credentials",
  "Remove Made with AI Label Signals",
  "Remove Image Backgrounds",
  "Image Compressor and Converter",
  "Compress an Image to a Target File Size",
  "Merge, Split, and Convert PDFs",
  "Generate and Decode QR Codes",
  "Methods and Limitations",
  "Open-source Licenses",
  "Terms of Use",
  "More tools and categories",
  "Open menu",
  "Save to My tools",
  "Remove from favorites",
  "File cannot exceed {size}MB",
  "{count} images selected",
  "{common} common tools first; expand {more} more by category",
  "Analyzing {count} image regions",
  "View {count} raw fields",
  "The pixel model estimates {score}% AI-like patterns, but provenance was unavailable.",
  "{count} file signals were read, but the pixel model was unavailable.",
  "Creating the {format} file",
  "{format} created locally",
  "Convert and download {format}",
  "{tools} tools · {categories} categories",
  "Original",
  "Result",
  "Transparent result",
]) sourceKeys.add(value)

const keys = [...sourceKeys].filter(Boolean).sort((a, b) => a.localeCompare(b))
fs.mkdirSync(path.resolve("lib/locales"), { recursive: true })

async function generateLanguage(language) {
  const outputPath = path.resolve(`lib/locales/${language}.json`)
  let output = {}
  if (fs.existsSync(outputPath)) {
    output = JSON.parse(fs.readFileSync(outputPath, "utf8"))
    if (keys.every((key) => key in output)) {
      applyOverrides(output, language)
      writeLocale(outputPath, output)
      console.log(`${language}: existing translation is complete`)
      return
    }
  }
  const missingKeys = keys.filter((key) => !(key in output))
  const batches = makeBatches(missingKeys, 5_000, 40)
  console.log(`${language}: translating ${missingKeys.length} missing messages`)
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex]
    const protectedItems = batch.map(protectTerms)
    const payload = protectedItems.map((item, index) => `<<<PICOKIT_${index}>>>\n${item.text}`).join("\n")
    const translated = await translate(payload, language)
    const parsed = parseBatch(translated, batch.length)
    for (let index = 0; index < batch.length; index += 1) {
      output[batch[index]] = restoreTerms(parsed[index], protectedItems[index].terms)
    }
    applyOverrides(output, language)
    writeLocale(outputPath, output)
    if ((batchIndex + 1) % 3 === 0 || batchIndex === batches.length - 1) {
      console.log(`${language}: ${batchIndex + 1}/${batches.length} batches`)
    }
    await new Promise((resolve) => setTimeout(resolve, 900))
  }
  applyOverrides(output, language)
  writeLocale(outputPath, output)
}

function applyOverrides(output, language) {
  Object.assign(
    output,
    overrides[language] ?? {},
    structuralOverrides[language] ?? {},
    precisionOverrides[language] ?? {},
    guideShellOverrides[language] ?? {},
    imageEditorOverrides[language] ?? {},
    backgroundRemovalOverrides[language] ?? {},
    backgroundModeOverrides[language] ?? {},
    batchQueueOverrides[language] ?? {},
    batchRefinementOverrides[language] ?? {},
    batchRefinementHintOverrides[language] ?? {},
    batchPipelineOverrides[language] ?? {},
    workflowContinuityOverrides[language] ?? {},
    refinementZoomOverrides[language] ?? {},
  )
}

function writeLocale(outputPath, output) {
  // Locale files are generated artifacts. Keep only messages that are still
  // present in the current source catalog so removed UI copy cannot linger.
  const ordered = Object.fromEntries(
    keys
      .filter((key) => key in output)
      .map((key) => [key, output[key]])
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  fs.writeFileSync(outputPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8")
}

async function translate(text, language) {
  let lastError
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await MET.translate(text, "en", language)
      const translated = result?.[0]?.translations?.[0]?.text
      if (!translated) throw new Error("Empty Microsoft Translator response")
      return translated
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000))
    }
  }
  throw lastError
}

function parseBatch(value, expectedCount) {
  const output = Array(expectedCount).fill("")
  const markers = [...value.matchAll(/PICOKIT_(\d+)/g)]
  for (let index = 0; index < markers.length; index += 1) {
    const match = markers[index]
    const start = (match.index ?? 0) + match[0].length
    const end = markers[index + 1]?.index ?? value.length
    output[Number(match[1])] = value.slice(start, end).replace(/^[<>＜＞\s]+|[<>＜＞\s]+$/g, "").trim()
  }
  if (output.some((item) => !item)) throw new Error(`Translation markers were not preserved (${output.filter(Boolean).length}/${expectedCount}, ${value.length} chars, tail: ${value.slice(-180)})`)
  return output
}

const protectedGlossary = [
  "Made with AI", "DigitalSourceType", "Content Credentials", "Apple Touch Icon", "Data URL", "Web Crypto",
  "MediaRecorder", "TabNative", "ChatGPT", "SynthID", "WebGPU", "JUMBF", "Base64", "glTF", "WebP", "WebM",
  "Gemini", "Doubao", "Jimeng", "C2PA", "EXIF", "XMP", "IPTC", "SHA-256", "UUID", "WASM", "JSON", "Markdown",
  "SVG", "PNG", "JPG", "JPEG", "GIF", "PDF", "HTML", "URL", "QR", "CSV", "TSV", "XLSX", "XLS", "WAV",
  "GLB", "OBJ", "FBX", "STL", "PLY", "MTL", "BIN", "MD5", "CPU", "GPU", "ICO", "PWA", "Blob", "Canvas",
]

function protectTerms(value) {
  const terms = []
  let text = value.replace(/\{[a-zA-Z][\w-]*\}/g, (term) => {
    const token = `__PKTERM_${terms.length}__`
    terms.push(term)
    return token
  })
  for (const term of protectedGlossary) {
    if (!text.includes(term)) continue
    const token = `__PKTERM_${terms.length}__`
    terms.push(term)
    text = text.split(term).join(token)
  }
  return { text, terms }
}

function restoreTerms(value, terms) {
  let output = value
  terms.forEach((term, index) => {
    output = output.replace(new RegExp(`__\\s*PKTERM\\s*_?\\s*${index}\\s*__`, "gi"), term)
  })
  return output.replace(/Tabnative/gi, "TabNative").trim()
}

function makeBatches(values, maxCharacters, maxItems = Number.POSITIVE_INFINITY) {
  const batches = []
  let current = []
  let size = 0
  for (const value of values) {
    if (current.length && (size + value.length > maxCharacters || current.length >= maxItems)) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(value)
    size += value.length + 32
  }
  if (current.length) batches.push(current)
  return batches
}

async function runWithConcurrency(values, concurrency, worker) {
  let index = 0
  async function next() {
    while (index < values.length) {
      const current = values[index]
      index += 1
      await worker(current)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
}

function extractEnglishKeys() {
  const output = new Set()
  const files = roots.flatMap(walk).filter((file) => /\.(?:ts|tsx)$/.test(file))
  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8")
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    visit(source)
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["pick", "format", "text"].includes(node.expression.text) && node.arguments.length >= 2) add(node.arguments[1])
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "step" && node.arguments.length >= 4) {
        add(node.arguments[1])
        add(node.arguments[3])
      }
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ["Localized", "Translated"].includes(node.tagName.getText(source))) {
        const attribute = node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText(source) === "en")
        if (attribute?.initializer && ts.isStringLiteral(attribute.initializer)) output.add(attribute.initializer.text.trim())
        if (attribute?.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) add(attribute.initializer.expression)
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(source)
        if ((name.endsWith("En") || name === "eyebrow") && node.initializer) {
          if (ts.isStringLiteral(node.initializer)) output.add(node.initializer.text.trim())
          if (ts.isJsxExpression(node.initializer) && node.initializer.expression) add(node.initializer.expression)
        }
      }
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(source).replace(/["']/g, "")
        if (name === "en" || name.endsWith("En")) add(node.initializer)
      }
      if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          if (!ts.isPropertyAssignment(property)) continue
          const localizedName = property.name.getText(source).replace(/["']/g, "")
          if (!localizedName.endsWith("Zh")) continue
          const englishName = localizedName.slice(0, -2)
          const englishProperty = node.properties.find((candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText(source).replace(/["']/g, "") === englishName)
          if (englishProperty && ts.isPropertyAssignment(englishProperty)) add(englishProperty.initializer)
        }
      }
      ts.forEachChild(node, visit)
    }
    function add(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) output.add(node.text.trim())
    }
  }
  return output
}

function walk(relativeRoot) {
  const absoluteRoot = path.resolve(relativeRoot)
  if (!fs.existsSync(absoluteRoot)) return []
  const output = []
  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const absolute = path.join(absoluteRoot, entry.name)
    if (entry.isDirectory()) output.push(...walk(path.relative(process.cwd(), absolute)))
    else output.push(path.relative(process.cwd(), absolute))
  }
  return output
}

const overrides = {
  ja: { "Common tools": "よく使うツール", "My tools": "マイツール", "More": "その他", "AI tools directory": "AIツール一覧", "PDF tools": "PDFツール", "Compress image": "画像を圧縮", "Remove background": "背景を削除", "AI image detector": "AI画像検出", "Choose a task": "やりたいことを選ぶ", "Search tools, formats, or features…": "ツール、形式、機能を検索…", "Save to My tools": "マイツールに保存", "Remove from favorites": "お気に入りから削除", "Saved": "保存済み", "Recent": "最近使用", "All tools": "すべてのツール", "More tools and categories": "その他のツールとカテゴリ", "Files stay on your device": "ファイルは端末内に保持されます", "No content uploads": "コンテンツをアップロードしません", "Uses local CPU/GPU": "端末のCPU/GPUを使用", "Works offline after caching": "キャッシュ後はオフラインで使用可能" },
  ko: { "Common tools": "자주 쓰는 도구", "My tools": "내 도구", "More": "더보기", "AI tools directory": "AI 도구 목록", "PDF tools": "PDF 도구", "Compress image": "이미지 압축", "Remove background": "배경 제거", "AI image detector": "AI 이미지 감지", "Choose a task": "할 일을 선택하세요", "Search tools, formats, or features…": "도구, 형식 또는 기능 검색…", "Save to My tools": "내 도구에 저장", "Remove from favorites": "즐겨찾기에서 삭제", "Saved": "저장됨", "Recent": "최근 사용", "All tools": "모든 도구", "More tools and categories": "더 많은 도구와 카테고리", "Files stay on your device": "파일은 기기에만 보관됩니다", "No content uploads": "콘텐츠를 업로드하지 않음", "Uses local CPU/GPU": "기기의 CPU/GPU 사용", "Works offline after caching": "캐시 후 오프라인 사용 가능" },
  es: { "Common tools": "Herramientas frecuentes", "My tools": "Mis herramientas", "More": "Más", "AI tools directory": "Directorio de herramientas de IA", "PDF tools": "Herramientas PDF", "Compress image": "Comprimir imagen", "Remove background": "Quitar fondo", "AI image detector": "Detector de imágenes de IA", "Choose a task": "Elige una tarea", "Search tools, formats, or features…": "Buscar herramientas, formatos o funciones…", "Save to My tools": "Guardar en Mis herramientas", "Remove from favorites": "Quitar de favoritos", "Saved": "Guardado", "Recent": "Recientes", "All tools": "Todas las herramientas", "More tools and categories": "Más herramientas y categorías", "Files stay on your device": "Los archivos permanecen en tu dispositivo", "No content uploads": "No se sube contenido", "Uses local CPU/GPU": "Usa la CPU/GPU del dispositivo", "Works offline after caching": "Funciona sin conexión después de guardarse en caché" },
  pt: { "Common tools": "Ferramentas frequentes", "My tools": "Minhas ferramentas", "More": "Mais", "AI tools directory": "Diretório de ferramentas de IA", "PDF tools": "Ferramentas PDF", "Compress image": "Comprimir imagem", "Remove background": "Remover fundo", "AI image detector": "Detetor de imagens de IA", "Choose a task": "Escolha uma tarefa", "Search tools, formats, or features…": "Pesquisar ferramentas, formatos ou funcionalidades…", "Save to My tools": "Guardar em Minhas ferramentas", "Remove from favorites": "Remover dos favoritos", "Saved": "Guardado", "Recent": "Recentes", "All tools": "Todas as ferramentas", "More tools and categories": "Mais ferramentas e categorias", "Files stay on your device": "Os ficheiros permanecem no seu dispositivo", "No content uploads": "Nenhum conteúdo é carregado", "Uses local CPU/GPU": "Utiliza a CPU/GPU do dispositivo", "Works offline after caching": "Funciona offline após ficar em cache" },
  id: { "Common tools": "Alat yang sering digunakan", "My tools": "Alat saya", "More": "Lainnya", "AI tools directory": "Direktori alat AI", "PDF tools": "Alat PDF", "Compress image": "Kompres gambar", "Remove background": "Hapus latar belakang", "AI image detector": "Detektor gambar AI", "Choose a task": "Pilih tugas", "Search tools, formats, or features…": "Cari alat, format, atau fitur…", "Save to My tools": "Simpan ke Alat saya", "Remove from favorites": "Hapus dari favorit", "Saved": "Tersimpan", "Recent": "Terbaru", "All tools": "Semua alat", "More tools and categories": "Alat dan kategori lainnya", "Files stay on your device": "File tetap di perangkat Anda", "No content uploads": "Konten tidak diunggah", "Uses local CPU/GPU": "Menggunakan CPU/GPU perangkat", "Works offline after caching": "Dapat digunakan offline setelah tersimpan di cache" },
  de: { "Common tools": "Häufig verwendete Tools", "My tools": "Meine Tools", "More": "Mehr", "AI tools directory": "KI-Tool-Verzeichnis", "PDF tools": "PDF-Tools", "Compress image": "Bild komprimieren", "Remove background": "Hintergrund entfernen", "AI image detector": "KI-Bilddetektor", "Choose a task": "Aufgabe auswählen", "Search tools, formats, or features…": "Tools, Formate oder Funktionen suchen…", "Save to My tools": "Unter „Meine Tools“ speichern", "Remove from favorites": "Aus Favoriten entfernen", "Saved": "Gespeichert", "Recent": "Zuletzt verwendet", "All tools": "Alle Tools", "More tools and categories": "Weitere Tools und Kategorien", "Files stay on your device": "Dateien bleiben auf deinem Gerät", "No content uploads": "Keine Inhalte werden hochgeladen", "Uses local CPU/GPU": "Verwendet CPU/GPU des Geräts", "Works offline after caching": "Nach dem Zwischenspeichern offline nutzbar" },
  pl: { "Common tools": "Często używane narzędzia", "My tools": "Moje narzędzia", "More": "Więcej", "AI tools directory": "Katalog narzędzi AI", "PDF tools": "Narzędzia PDF", "Compress image": "Kompresuj obraz", "Remove background": "Usuń tło", "AI image detector": "Wykrywanie obrazów AI", "Choose a task": "Wybierz zadanie", "Search tools, formats, or features…": "Szukaj narzędzi, formatów lub funkcji…", "Save to My tools": "Zapisz w Moich narzędziach", "Remove from favorites": "Usuń z ulubionych", "Saved": "Zapisano", "Recent": "Ostatnio używane", "All tools": "Wszystkie narzędzia", "More tools and categories": "Więcej narzędzi i kategorii", "Files stay on your device": "Pliki pozostają na Twoim urządzeniu", "No content uploads": "Treści nie są przesyłane", "Uses local CPU/GPU": "Używa CPU/GPU urządzenia", "Works offline after caching": "Działa offline po zapisaniu w pamięci podręcznej" },
  ru: { "Common tools": "Часто используемые инструменты", "My tools": "Мои инструменты", "More": "Ещё", "AI tools directory": "Каталог инструментов ИИ", "PDF tools": "Инструменты PDF", "Compress image": "Сжать изображение", "Remove background": "Удалить фон", "AI image detector": "Детектор изображений ИИ", "Choose a task": "Выберите задачу", "Search tools, formats, or features…": "Поиск инструментов, форматов или функций…", "Save to My tools": "Сохранить в «Мои инструменты»", "Remove from favorites": "Удалить из избранного", "Saved": "Сохранено", "Recent": "Недавние", "All tools": "Все инструменты", "More tools and categories": "Другие инструменты и категории", "Files stay on your device": "Файлы остаются на вашем устройстве", "No content uploads": "Контент не загружается", "Uses local CPU/GPU": "Использует CPU/GPU устройства", "Works offline after caching": "Работает офлайн после кэширования" },
  fr: { "Common tools": "Outils courants", "My tools": "Mes outils", "More": "Plus", "AI tools directory": "Répertoire d’outils d’IA", "PDF tools": "Outils PDF", "Compress image": "Compresser l’image", "Remove background": "Supprimer l’arrière-plan", "AI image detector": "Détecteur d’images IA", "Choose a task": "Choisissez une tâche", "Search tools, formats, or features…": "Rechercher des outils, formats ou fonctions…", "Save to My tools": "Enregistrer dans Mes outils", "Remove from favorites": "Retirer des favoris", "Saved": "Enregistré", "Recent": "Récents", "All tools": "Tous les outils", "More tools and categories": "Plus d’outils et de catégories", "Files stay on your device": "Les fichiers restent sur votre appareil", "No content uploads": "Aucun contenu n’est envoyé", "Uses local CPU/GPU": "Utilise le CPU/GPU de l’appareil", "Works offline after caching": "Fonctionne hors ligne après mise en cache" },
  ar: { "Common tools": "الأدوات الشائعة", "My tools": "أدواتي", "More": "المزيد", "AI tools directory": "دليل أدوات الذكاء الاصطناعي", "PDF tools": "أدوات PDF", "Compress image": "ضغط الصورة", "Remove background": "إزالة الخلفية", "AI image detector": "كاشف صور الذكاء الاصطناعي", "Choose a task": "اختر مهمة", "Search tools, formats, or features…": "ابحث عن أداة أو تنسيق أو ميزة…", "Save to My tools": "حفظ في أدواتي", "Remove from favorites": "إزالة من المفضلة", "Saved": "محفوظ", "Recent": "المستخدمة مؤخراً", "All tools": "كل الأدوات", "More tools and categories": "المزيد من الأدوات والفئات", "Files stay on your device": "تبقى الملفات على جهازك", "No content uploads": "لا يتم رفع المحتوى", "Uses local CPU/GPU": "يستخدم CPU/GPU في جهازك", "Works offline after caching": "يعمل دون اتصال بعد التخزين المؤقت" },
  tr: { "Common tools": "Sık kullanılan araçlar", "My tools": "Araçlarım", "More": "Daha fazla", "AI tools directory": "Yapay zekâ araçları dizini", "PDF tools": "PDF araçları", "Compress image": "Görseli sıkıştır", "Remove background": "Arka planı kaldır", "AI image detector": "Yapay zekâ görsel algılayıcı", "Choose a task": "Bir görev seçin", "Search tools, formats, or features…": "Araç, biçim veya özellik ara…", "Save to My tools": "Araçlarım’a kaydet", "Remove from favorites": "Favorilerden kaldır", "Saved": "Kaydedildi", "Recent": "Son kullanılanlar", "All tools": "Tüm araçlar", "More tools and categories": "Daha fazla araç ve kategori", "Files stay on your device": "Dosyalar cihazınızda kalır", "No content uploads": "İçerik yüklenmez", "Uses local CPU/GPU": "Cihazın CPU/GPU’sunu kullanır", "Works offline after caching": "Önbelleğe alındıktan sonra çevrimdışı çalışır" },
}

const structuralOverrides = {
  ja: {
    "{tools} tools · {categories} categories": "{tools}個のツール · {categories}カテゴリ",
    "{common} common tools first; expand {more} more by category": "よく使うツールを{common}個表示し、残り{more}個はカテゴリ別に展開できます",
    "Save {name} to My tools": "{name}をマイツールに保存",
    "Remove {name} from favorites": "{name}をお気に入りから削除",
    "Browse common tools": "よく使うツールを見る",
    "No account": "アカウント不要",
    "No uploads": "アップロードなし",
  },
  ko: {
    "{tools} tools · {categories} categories": "{tools}개 도구 · {categories}개 카테고리",
    "{common} common tools first; expand {more} more by category": "자주 쓰는 도구 {common}개를 먼저 표시하고, 나머지 {more}개는 카테고리별로 펼쳐 볼 수 있습니다",
    "Save {name} to My tools": "내 도구에 {name} 저장",
    "Remove {name} from favorites": "즐겨찾기에서 {name} 삭제",
  },
  es: {
    "{tools} tools · {categories} categories": "{tools} herramientas · {categories} categorías",
    "{common} common tools first; expand {more} more by category": "Primero se muestran {common} herramientas frecuentes; despliega {more} más por categoría",
    "Save {name} to My tools": "Guardar {name} en Mis herramientas",
    "Remove {name} from favorites": "Quitar {name} de favoritos",
  },
  pt: {
    "{tools} tools · {categories} categories": "{tools} ferramentas · {categories} categorias",
    "{common} common tools first; expand {more} more by category": "Mostramos primeiro {common} ferramentas frequentes; expanda mais {more} por categoria",
    "Save {name} to My tools": "Guardar {name} em Minhas ferramentas",
    "Remove {name} from favorites": "Remover {name} dos favoritos",
  },
  id: {
    "{tools} tools · {categories} categories": "{tools} alat · {categories} kategori",
    "{common} common tools first; expand {more} more by category": "{common} alat yang sering digunakan ditampilkan lebih dulu; buka {more} lainnya menurut kategori",
    "Save {name} to My tools": "Simpan {name} ke Alat saya",
    "Remove {name} from favorites": "Hapus {name} dari favorit",
  },
  de: {
    "{tools} tools · {categories} categories": "{tools} Tools · {categories} Kategorien",
    "{common} common tools first; expand {more} more by category": "Zuerst werden {common} häufig verwendete Tools angezeigt; weitere {more} lassen sich nach Kategorie einblenden",
    "Save {name} to My tools": "{name} unter „Meine Tools“ speichern",
    "Remove {name} from favorites": "{name} aus Favoriten entfernen",
    "Analyze generation patterns and file-provenance evidence together. Detection runs in your browser and the image is never uploaded; results are risk signals, not an absolute verdict.": "Analysieren Sie Erzeugungsmuster und Herkunftsnachweise der Datei gemeinsam. Die Erkennung läuft in Ihrem Browser und das Bild wird nie hochgeladen; die Ergebnisse sind Risikosignale, kein endgültiges Urteil.",
  },
  pl: {
    "{tools} tools · {categories} categories": "{tools} narzędzi · {categories} kategorii",
    "{common} common tools first; expand {more} more by category": "Najpierw wyświetlamy {common} często używanych narzędzi; pozostałe {more} rozwiń według kategorii",
    "Save {name} to My tools": "Zapisz {name} w Moich narzędziach",
    "Remove {name} from favorites": "Usuń {name} z ulubionych",
    "Decode component": "Dekodowanie",
    "Favicon Generator": "Generator favicon",
    "Medium": "Średni",
  },
  ru: {
    "{tools} tools · {categories} categories": "{tools} инструментов · {categories} категорий",
    "{common} common tools first; expand {more} more by category": "Сначала показаны {common} часто используемых инструментов; ещё {more} доступны по категориям",
    "Save {name} to My tools": "Сохранить {name} в «Мои инструменты»",
    "Remove {name} from favorites": "Удалить {name} из избранного",
    "Image Compressor": "Сжатие изображений",
    "Manual": "Вручную",
    "Minify": "Минифицировать",
    "QR Code Toolkit": "Инструменты QR-кодов",
  },
  fr: {
    "{tools} tools · {categories} categories": "{tools} outils · {categories} catégories",
    "{common} common tools first; expand {more} more by category": "Affichez d’abord {common} outils courants, puis dépliez les {more} autres par catégorie",
    "Save {name} to My tools": "Enregistrer {name} dans Mes outils",
    "Remove {name} from favorites": "Retirer {name} des favoris",
    "Audio Trimmer": "Découpeur audio",
    "Clear recent": "Effacer les éléments récents",
    "Image & Design": "Image et design",
    "Meshes": "Maillages",
  },
  ar: {
    "{tools} tools · {categories} categories": "{tools} أداة · {categories} فئات",
    "{common} common tools first; expand {more} more by category": "نعرض أولاً {common} أدوات شائعة، ويمكنك إظهار {more} أدوات أخرى حسب الفئة",
    "Save {name} to My tools": "حفظ {name} في أدواتي",
    "Remove {name} from favorites": "إزالة {name} من المفضلة",
    "Current device": "الجهاز الحالي",
    "Inference backend": "محرك الاستدلال",
    "WebGPU preferred": "WebGPU مفضّل",
    "WASM fallback": "بديل WASM",
    "CPU threads": "مسارات CPU",
    "Device memory": "ذاكرة الجهاز",
    "Terms": "شروط الاستخدام",
    "Free · No account · On-device": "مجاني · دون حساب · معالجة على الجهاز",
    "No account": "دون حساب",
    "No uploads": "دون رفع ملفات",
    "Drop an image, or click to choose": "اسحب صورة أو انقر للاختيار",
    "Password & UUID Generator": "مولّد كلمات المرور وUUID",
  },
  tr: {
    "{tools} tools · {categories} categories": "{tools} araç · {categories} kategori",
    "{common} common tools first; expand {more} more by category": "Önce {common} sık kullanılan araç gösterilir; kalan {more} aracı kategoriye göre açabilirsiniz",
    "Save {name} to My tools": "{name} aracını Araçlarım’a kaydet",
    "Remove {name} from favorites": "{name} aracını favorilerden kaldır",
    "Medium": "Orta",
    "Minify": "Küçült",
    "Segment": "Bölüm",
  },
}

const precisionOverrides = {
  ja: {
    "Guides": "使い方ガイド",
    "Local Unit & Ratio Toolkit": "ローカル単位・画像比率ツール",
    "Unit & Aspect-ratio Tools": "単位・画像比率ツール",
    "Unit Converter and Aspect-ratio Calculator": "単位変換・画像比率計算",
    "Convert common units and calculate image ratios and proportional sizes.": "一般的な単位を変換し、画像の縦横比と同比率のサイズを計算します。",
    "Popular tool guides": "よく使うツールのガイド",
    "Start with common tasks": "よく使う作業から始める",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "各ガイドでは、準備から操作、結果の確認、よくある問題の解決まで順に説明します。",
    "All guides": "すべての使い方ガイド",
    "Find the tool you are using": "使用中のツールを探す",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "名前、用途、カテゴリで検索できます。TabNative の各ローカルツールに対応するガイドがあります。",
    "Tool guide": "ツールの使い方",
    "Read guide": "ガイドを読む",
    "Mass": "質量",
    "From": "変換元",
    "To": "変換先",
    "How to use {name}": "{name}の使い方",
    "Open {name}": "{name}を開く",
  },
  ko: {
    "Guides": "사용 안내",
    "Local Unit & Ratio Toolkit": "로컬 단위 및 이미지 비율 도구",
    "Unit & Aspect-ratio Tools": "단위 및 이미지 비율 도구",
    "Unit Converter and Aspect-ratio Calculator": "단위 변환 및 이미지 비율 계산기",
    "Convert common units and calculate image ratios and proportional sizes.": "일반 단위를 변환하고 이미지 비율과 비례 크기를 계산합니다.",
    "Popular tool guides": "자주 쓰는 도구 안내",
    "Start with common tasks": "자주 하는 작업부터 시작하세요",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "모든 안내는 준비, 작업, 결과 확인, 자주 발생하는 문제 해결 순서로 설명합니다.",
    "All guides": "모든 사용 안내",
    "Find the tool you are using": "사용 중인 도구 찾기",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "이름, 용도 또는 카테고리로 검색하세요. 모든 TabNative 로컬 도구에 해당 사용 안내가 있습니다.",
    "Tool guide": "도구 사용 안내",
    "Read guide": "안내 보기",
    "Mass": "질량",
    "From": "변환 전",
    "To": "변환 후",
    "How to use {name}": "{name} 사용 방법",
    "Open {name}": "{name} 열기",
  },
  es: {
    "Guides": "Guías",
    "Local Unit & Ratio Toolkit": "Herramientas locales de unidades y proporciones",
    "Unit & Aspect-ratio Tools": "Herramientas de unidades y proporciones de imagen",
    "Unit Converter and Aspect-ratio Calculator": "Conversor de unidades y calculadora de proporciones de imagen",
    "Convert common units and calculate image ratios and proportional sizes.": "Convierte unidades habituales y calcula proporciones y tamaños equivalentes de imágenes.",
    "Popular tool guides": "Guías de herramientas populares",
    "Start with common tasks": "Empieza por las tareas habituales",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Cada guía explica la preparación, los pasos, la verificación del resultado y las soluciones a problemas habituales.",
    "All guides": "Todas las guías",
    "Find the tool you are using": "Encuentra la herramienta que estás usando",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Busca por nombre, función o categoría. Cada herramienta local de TabNative tiene su propia guía.",
    "Tool guide": "Guía de la herramienta",
    "Read guide": "Leer la guía",
    "Mass": "Masa",
    "From": "De",
    "To": "A",
    "How to use {name}": "Cómo usar {name}",
    "Open {name}": "Abrir {name}",
    "A free on-device toolkit for checking AI-generated signals and working with images, PDFs, text, audio, video, and 3D models. No sign-up; files stay on your device.": "Un conjunto gratuito de herramientas que funciona en tu dispositivo para comprobar señales generadas por IA y trabajar con imágenes, PDF, texto, audio, vídeo y modelos 3D. No necesitas registrarte y tus archivos permanecen en tu dispositivo.",
    "A toolbox on your device, not a cloud black box": "Una caja de herramientas en tu dispositivo, no una caja negra en la nube",
    "Check for AI signals, edit audio and video, and work with 3D models": "Comprueba señales de IA, edita audio y vídeo y trabaja con modelos 3D",
    "Images stay on your device while decoding": "Las imágenes permanecen en tu dispositivo durante la decodificación",
    "Work with GIFs, audio, video frames, and local screen recordings": "Trabaja con GIF, audio, fotogramas de vídeo y grabaciones de pantalla locales",
    "Work with images, PDFs, text, audio, video, and 3D models, or check text and images for AI-generated signals. No sign-up; files stay on your device.": "Trabaja con imágenes, PDF, texto, audio, vídeo y modelos 3D, o comprueba señales de IA en textos e imágenes. No necesitas registrarte y tus archivos permanecen en tu dispositivo.",
  },
  pt: {
    "Guides": "Guias",
    "Local Unit & Ratio Toolkit": "Ferramentas locais de unidades e proporções",
    "Unit & Aspect-ratio Tools": "Ferramentas de unidades e proporções de imagem",
    "Unit Converter and Aspect-ratio Calculator": "Conversor de unidades e calculadora de proporções de imagem",
    "Convert common units and calculate image ratios and proportional sizes.": "Converta unidades comuns e calcule proporções e dimensões equivalentes de imagens.",
    "Popular tool guides": "Guias das ferramentas mais usadas",
    "Start with common tasks": "Comece pelas tarefas mais comuns",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Cada guia explica a preparação, os passos, a verificação do resultado e as soluções para problemas comuns.",
    "All guides": "Todos os guias",
    "Find the tool you are using": "Encontre a ferramenta que está a usar",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Pesquise por nome, finalidade ou categoria. Cada ferramenta local do TabNative tem um guia correspondente.",
    "Tool guide": "Guia da ferramenta",
    "Read guide": "Ler o guia",
    "Mass": "Massa",
    "From": "De",
    "To": "Para",
    "How to use {name}": "Como usar {name}",
    "Open {name}": "Abrir {name}",
  },
  id: {
    "Guides": "Panduan",
    "Local Unit & Ratio Toolkit": "Alat satuan dan rasio lokal",
    "Unit & Aspect-ratio Tools": "Alat satuan dan rasio gambar",
    "Unit Converter and Aspect-ratio Calculator": "Konverter satuan dan kalkulator rasio gambar",
    "Convert common units and calculate image ratios and proportional sizes.": "Konversikan satuan umum dan hitung rasio serta ukuran gambar secara proporsional.",
    "Popular tool guides": "Panduan alat populer",
    "Start with common tasks": "Mulai dari tugas yang paling umum",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Setiap panduan menjelaskan persiapan, langkah penggunaan, pemeriksaan hasil, dan solusi untuk masalah umum.",
    "All guides": "Semua panduan",
    "Find the tool you are using": "Temukan alat yang sedang Anda gunakan",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Cari berdasarkan nama, kegunaan, atau kategori. Setiap alat lokal TabNative memiliki panduan yang sesuai.",
    "Tool guide": "Panduan alat",
    "Read guide": "Baca panduan",
    "Mass": "Massa",
    "From": "Dari",
    "To": "Ke",
    "How to use {name}": "Cara menggunakan {name}",
    "Open {name}": "Buka {name}",
  },
  de: {
    "Guides": "Anleitungen",
    "Local Unit & Ratio Toolkit": "Lokale Einheiten- und Seitenverhältnis-Tools",
    "Unit & Aspect-ratio Tools": "Einheiten- und Bildseitenverhältnis-Tools",
    "Unit Converter and Aspect-ratio Calculator": "Einheitenumrechner und Rechner für Bildseitenverhältnisse",
    "Convert common units and calculate image ratios and proportional sizes.": "Rechne gängige Einheiten um und berechne Seitenverhältnisse sowie proportionale Bildgrößen.",
    "Popular tool guides": "Anleitungen für häufig verwendete Tools",
    "Start with common tasks": "Beginne mit häufigen Aufgaben",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Jede Anleitung führt durch Vorbereitung, Arbeitsschritte, Ergebnisprüfung und häufige Problemlösungen.",
    "All guides": "Alle Anleitungen",
    "Find the tool you are using": "Finde das verwendete Tool",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Suche nach Name, Zweck oder Kategorie. Für jedes lokale TabNative-Tool gibt es eine passende Anleitung.",
    "Tool guide": "Tool-Anleitung",
    "Read guide": "Anleitung lesen",
    "Mass": "Masse",
    "From": "Von",
    "To": "Nach",
    "How to use {name}": "So verwendest du {name}",
    "Open {name}": "{name} öffnen",
  },
  pl: {
    "Guides": "Poradniki",
    "Local Unit & Ratio Toolkit": "Lokalne narzędzia do jednostek i proporcji obrazu",
    "Convert common units and calculate image ratios and proportional sizes.": "Przeliczaj popularne jednostki oraz obliczaj proporcje i wymiary obrazu.",
    "Popular tool guides": "Poradniki do popularnych narzędzi",
    "Start with common tasks": "Zacznij od typowych zadań",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Każdy poradnik opisuje przygotowanie, kolejne kroki, sprawdzenie wyniku i rozwiązania typowych problemów.",
    "All guides": "Wszystkie poradniki",
    "Find the tool you are using": "Znajdź używane narzędzie",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Szukaj według nazwy, zastosowania lub kategorii. Każde lokalne narzędzie TabNative ma odpowiedni poradnik.",
    "Tool guide": "Poradnik narzędzia",
    "Read guide": "Przeczytaj poradnik",
    "Mass": "Masa",
    "From": "Z",
    "To": "Na",
    "How to use {name}": "Jak używać {name}",
    "Open {name}": "Otwórz {name}",
    "Unit Converter and Aspect-ratio Calculator": "Konwerter jednostek i kalkulator proporcji obrazu",
    "Unit & Aspect-ratio Tools": "Narzędzia do jednostek i proporcji obrazu",
    "Aspect ratio and proportional resize": "Proporcje obrazu i skalowanie proporcjonalne",
  },
  ru: {
    "Guides": "Руководства",
    "Local Unit & Ratio Toolkit": "Локальные инструменты для единиц и пропорций",
    "Unit & Aspect-ratio Tools": "Единицы и пропорции изображения",
    "Unit Converter and Aspect-ratio Calculator": "Конвертер единиц и калькулятор пропорций изображения",
    "Convert common units and calculate image ratios and proportional sizes.": "Конвертируйте распространённые единицы и рассчитывайте пропорции и размеры изображения.",
    "Popular tool guides": "Руководства по популярным инструментам",
    "Start with common tasks": "Начните с распространённых задач",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Каждое руководство описывает подготовку, шаги работы, проверку результата и решение типичных проблем.",
    "All guides": "Все руководства",
    "Find the tool you are using": "Найдите нужный инструмент",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Ищите по названию, назначению или категории. Для каждого локального инструмента TabNative есть руководство.",
    "Tool guide": "Руководство по инструменту",
    "Read guide": "Читать руководство",
    "Mass": "Масса",
    "From": "Из",
    "To": "В",
    "How to use {name}": "Как использовать {name}",
    "Open {name}": "Открыть {name}",
    "A free on-device toolkit for checking AI-generated signals and working with images, PDFs, text, audio, video, and 3D models. No sign-up; files stay on your device.": "Бесплатный набор инструментов, который работает на вашем устройстве: проверяйте признаки контента, созданного ИИ, и работайте с изображениями, PDF, текстом, аудио, видео и 3D-моделями. Регистрация не требуется, файлы остаются на вашем устройстве.",
    "Work with images, PDFs, text, audio, video, and 3D models, or check text and images for AI-generated signals. No sign-up; files stay on your device.": "Работайте с изображениями, PDF, текстом, аудио, видео и 3D-моделями или проверяйте текст и изображения на признаки контента, созданного ИИ. Регистрация не требуется, файлы остаются на вашем устройстве.",
  },
  fr: {
    "Guides": "Guides",
    "Local Unit & Ratio Toolkit": "Outils locaux d’unités et de proportions",
    "Unit & Aspect-ratio Tools": "Outils d’unités et de proportions d’image",
    "Unit Converter and Aspect-ratio Calculator": "Convertisseur d’unités et calculateur de proportions d’image",
    "Convert common units and calculate image ratios and proportional sizes.": "Convertissez les unités courantes et calculez les proportions et dimensions d’une image.",
    "Popular tool guides": "Guides des outils les plus utilisés",
    "Start with common tasks": "Commencez par les tâches courantes",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Chaque guide explique la préparation, les étapes, la vérification du résultat et les solutions aux problèmes courants.",
    "All guides": "Tous les guides",
    "Find the tool you are using": "Trouvez l’outil que vous utilisez",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Recherchez par nom, usage ou catégorie. Chaque outil local TabNative dispose de son propre guide.",
    "Tool guide": "Guide de l’outil",
    "Read guide": "Lire le guide",
    "Mass": "Masse",
    "From": "De",
    "To": "Vers",
    "How to use {name}": "Comment utiliser {name}",
    "Open {name}": "Ouvrir {name}",
  },
  ar: {
    "Guides": "الأدلة",
    "Local Unit & Ratio Toolkit": "أدوات محلية للوحدات والنسب",
    "Convert common units and calculate image ratios and proportional sizes.": "حوّل أي وحدة شائعة واحسب نسبة الصورة وأبعادها المتناسبة.",
    "Popular tool guides": "أدلة الأدوات الشائعة",
    "Start with common tasks": "ابدأ بالمهام الشائعة",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "يشرح كل دليل التحضير والخطوات والتحقق من النتيجة وحلول المشكلات الشائعة.",
    "All guides": "جميع الأدلة",
    "Find the tool you are using": "ابحث عن الأداة التي تستخدمها",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "ابحث بالاسم أو الاستخدام أو الفئة. لكل أداة محلية في TabNative دليل مناسب.",
    "Tool guide": "دليل الأداة",
    "Read guide": "قراءة الدليل",
    "Mass": "الكتلة",
    "From": "من",
    "To": "إلى",
    "How to use {name}": "كيفية استخدام {name}",
    "Open {name}": "فتح {name}",
    "Unit Converter and Aspect-ratio Calculator": "محوّل الوحدات وحاسبة نسبة العرض إلى الارتفاع",
    "Unit & Aspect-ratio Tools": "أدوات الوحدات ونسبة العرض إلى الارتفاع",
    "Aspect ratio and proportional resize": "نسبة العرض إلى الارتفاع وتغيير الحجم بشكل متناسب",
  },
  tr: {
    "Guides": "Rehberler",
    "Local Unit & Ratio Toolkit": "Yerel birim ve oran araçları",
    "Unit & Aspect-ratio Tools": "Birim ve görsel oran araçları",
    "Unit Converter and Aspect-ratio Calculator": "Birim dönüştürücü ve görsel oran hesaplayıcı",
    "Convert common units and calculate image ratios and proportional sizes.": "Yaygın birimleri dönüştürün; görsel oranlarını ve orantılı boyutları hesaplayın.",
    "Popular tool guides": "Sık kullanılan araç rehberleri",
    "Start with common tasks": "Yaygın görevlerle başlayın",
    "Every guide starts with preparation, then walks through the task, verification, and common fixes.": "Her rehber hazırlık, işlem adımları, sonuç kontrolü ve yaygın sorunların çözümlerini açıklar.",
    "All guides": "Tüm rehberler",
    "Find the tool you are using": "Kullandığınız aracı bulun",
    "Search by name, purpose, or category. Every TabNative on-device tool has a matching guide.": "Ada, kullanım amacına veya kategoriye göre arayın. Her yerel TabNative aracı için uygun bir rehber vardır.",
    "Tool guide": "Araç rehberi",
    "Read guide": "Rehberi oku",
    "Mass": "Kütle",
    "From": "Kaynak",
    "To": "Hedef",
    "How to use {name}": "{name} nasıl kullanılır",
    "Open {name}": "{name} aracını aç",
  },
}

const guideShellOverrides = {
  ja: {
    "minutes": "分",
    "Estimated read": "読了目安",
    "Tool covered": "対象ツール",
    "On-device": "端末内処理",
    "Privacy model": "プライバシー方式",
    "Open tool": "ツールを開く",
    "min": "分",
    "min read": "分で読めます",
    "Keep learning": "関連ガイドも見る",
    "Related tool guides": "関連するツールガイド",
  },
  ko: {
    "minutes": "분",
    "Estimated read": "예상 읽기 시간",
    "Tool covered": "대상 도구",
    "On-device": "기기 내 처리",
    "Privacy model": "개인정보 처리 방식",
    "Open tool": "도구 열기",
    "min": "분",
    "min read": "분 소요",
    "Keep learning": "다른 안내도 보기",
    "Related tool guides": "관련 도구 사용 안내",
  },
  es: {
    "minutes": "minutos",
    "Estimated read": "Tiempo de lectura",
    "Tool covered": "Herramienta",
    "On-device": "En tu dispositivo",
    "Privacy model": "Tratamiento de datos",
    "Open tool": "Abrir la herramienta",
    "min": "min",
    "min read": "min de lectura",
    "Keep learning": "Sigue aprendiendo",
    "Related tool guides": "Guías relacionadas",
  },
  pt: {
    "minutes": "minutos",
    "Estimated read": "Tempo de leitura",
    "Tool covered": "Ferramenta",
    "On-device": "No dispositivo",
    "Privacy model": "Tratamento de dados",
    "Open tool": "Abrir a ferramenta",
    "min": "min",
    "min read": "min de leitura",
    "Keep learning": "Continue a explorar",
    "Related tool guides": "Guias relacionados",
  },
  id: {
    "minutes": "menit",
    "Estimated read": "Waktu baca",
    "Tool covered": "Alat",
    "On-device": "Diproses di perangkat",
    "Privacy model": "Model privasi",
    "Open tool": "Buka alat",
    "min": "menit",
    "min read": "menit baca",
    "Keep learning": "Lihat panduan lain",
    "Related tool guides": "Panduan alat terkait",
  },
  de: {
    "minutes": "Minuten",
    "Estimated read": "Lesezeit",
    "Tool covered": "Behandeltes Tool",
    "On-device": "Auf dem Gerät",
    "Privacy model": "Datenschutz",
    "Open tool": "Tool öffnen",
    "min": "Min.",
    "min read": "Min. Lesezeit",
    "Keep learning": "Weitere Anleitungen",
    "Related tool guides": "Passende Tool-Anleitungen",
  },
  pl: {
    "minutes": "minut",
    "Estimated read": "Czas czytania",
    "Tool covered": "Opisywane narzędzie",
    "On-device": "Na urządzeniu",
    "Privacy model": "Sposób ochrony prywatności",
    "Open tool": "Otwórz narzędzie",
    "min": "min",
    "min read": "min czytania",
    "Keep learning": "Czytaj dalej",
    "Related tool guides": "Powiązane poradniki",
  },
  ru: {
    "minutes": "минут",
    "Estimated read": "Время чтения",
    "Tool covered": "Описываемый инструмент",
    "On-device": "На устройстве",
    "Privacy model": "Обработка данных",
    "Open tool": "Открыть инструмент",
    "min": "мин",
    "min read": "мин чтения",
    "Keep learning": "Продолжить чтение",
    "Related tool guides": "Связанные руководства",
  },
  fr: {
    "minutes": "minutes",
    "Estimated read": "Temps de lecture",
    "Tool covered": "Outil concerné",
    "On-device": "Sur l’appareil",
    "Privacy model": "Traitement des données",
    "Open tool": "Ouvrir l’outil",
    "min": "min",
    "min read": "min de lecture",
    "Keep learning": "Continuer",
    "Related tool guides": "Guides associés",
  },
  ar: {
    "minutes": "دقائق",
    "Estimated read": "مدة القراءة",
    "Tool covered": "الأداة المشروحة",
    "On-device": "على الجهاز",
    "Privacy model": "طريقة حماية الخصوصية",
    "Open tool": "فتح الأداة",
    "min": "د",
    "min read": "دقائق للقراءة",
    "Keep learning": "تابع القراءة",
    "Related tool guides": "أدلة ذات صلة",
  },
  tr: {
    "minutes": "dakika",
    "Estimated read": "Okuma süresi",
    "Tool covered": "Anlatılan araç",
    "On-device": "Cihazda",
    "Privacy model": "Gizlilik yöntemi",
    "Open tool": "Aracı aç",
    "min": "dk",
    "min read": "dk okuma",
    "Keep learning": "Okumaya devam et",
    "Related tool guides": "İlgili araç rehberleri",
  },
}

// Mask-editing controls are short and ambiguous out of context. Keep these
// action labels aligned with the actual restore/erase behavior in every locale.
const backgroundRemovalOverrides = {
  ja: {
    "Keep": "復元", "Remove": "消去", "Undo": "元に戻す", "Reset": "リセット", "Apply": "適用",
    "Refine edges": "エッジを調整", "Brush size": "ブラシサイズ", "Edge softness": "エッジのぼかし",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "「復元」で欠けた被写体を戻し、「消去」で残った背景を消します。適用前にエッジのぼかしを調整できます。変更されるのは端末内のアルファマスクだけです。",
  },
  ko: {
    "Keep": "복원", "Remove": "지우기", "Undo": "실행 취소", "Reset": "초기화", "Apply": "적용",
    "Refine edges": "가장자리 다듬기", "Brush size": "브러시 크기", "Edge softness": "가장자리 부드럽게",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "‘복원’으로 잘린 피사체를 되살리고 ‘지우기’로 남은 배경을 지운 뒤, 적용하기 전에 가장자리 부드러움을 조절하세요. 변경되는 것은 기기 안의 알파 마스크뿐입니다.",
  },
  es: {
    "Keep": "Conservar", "Remove": "Borrar", "Undo": "Deshacer", "Reset": "Restablecer", "Apply": "Aplicar",
    "Refine edges": "Refinar bordes", "Brush size": "Tamaño del pincel", "Edge softness": "Suavizado de bordes",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Usa Conservar para recuperar partes del sujeto y Borrar para eliminar restos del fondo. Ajusta el suavizado antes de aplicar. Solo se modifica la máscara alfa local.",
  },
  pt: {
    "Keep": "Manter", "Remove": "Apagar", "Undo": "Desfazer", "Reset": "Redefinir", "Apply": "Aplicar",
    "Refine edges": "Refinar bordas", "Brush size": "Tamanho do pincel", "Edge softness": "Suavização das bordas",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Use Manter para recuperar partes do objeto e Apagar para remover restos do fundo. Ajuste a suavização antes de aplicar. Apenas a máscara alfa local é alterada.",
  },
  id: {
    "Keep": "Pulihkan", "Remove": "Hapus", "Undo": "Urungkan", "Reset": "Atur ulang", "Apply": "Terapkan",
    "Refine edges": "Sempurnakan tepi", "Brush size": "Ukuran kuas", "Edge softness": "Kelembutan tepi",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Gunakan Pulihkan untuk mengembalikan bagian subjek yang hilang dan Hapus untuk membersihkan sisa latar. Atur kelembutan tepi sebelum menerapkan. Hanya mask alfa lokal yang diubah.",
  },
  de: {
    "Keep": "Behalten", "Remove": "Entfernen", "Undo": "Rückgängig", "Reset": "Zurücksetzen", "Apply": "Anwenden",
    "Refine edges": "Kanten verfeinern", "Brush size": "Pinselgröße", "Edge softness": "Kantenweichzeichnung",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Mit Behalten stellst du fehlende Motivbereiche wieder her, mit Entfernen löschst du Hintergrundreste. Passe vor dem Anwenden die Kantenweichzeichnung an. Geändert wird nur die lokale Alphamaske.",
  },
  pl: {
    "Keep": "Zachowaj", "Remove": "Usuń", "Undo": "Cofnij", "Reset": "Resetuj", "Apply": "Zastosuj",
    "Refine edges": "Dopracuj krawędzie", "Brush size": "Rozmiar pędzla", "Edge softness": "Miękkość krawędzi",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Użyj opcji Zachowaj, aby odtworzyć brakujące fragmenty obiektu, oraz Usuń, aby wymazać resztki tła. Przed zastosowaniem ustaw miękkość krawędzi. Zmieniana jest tylko lokalna maska alfa.",
  },
  ru: {
    "Keep": "Восстановить", "Remove": "Стереть", "Undo": "Отменить", "Reset": "Сбросить", "Apply": "Применить",
    "Refine edges": "Уточнить края", "Brush size": "Размер кисти", "Edge softness": "Мягкость краёв",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Используйте «Восстановить», чтобы вернуть части объекта, и «Стереть», чтобы убрать остатки фона. Перед применением настройте мягкость краёв. Меняется только локальная альфа-маска.",
  },
  fr: {
    "Keep": "Conserver", "Remove": "Effacer", "Undo": "Annuler", "Reset": "Réinitialiser", "Apply": "Appliquer",
    "Refine edges": "Affiner les contours", "Brush size": "Taille du pinceau", "Edge softness": "Adoucissement des contours",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Utilisez Conserver pour restaurer les parties manquantes du sujet et Effacer pour retirer les restes de fond. Réglez l’adoucissement avant d’appliquer. Seul le masque alpha local est modifié.",
  },
  ar: {
    "Keep": "استعادة", "Remove": "مسح", "Undo": "تراجع", "Reset": "إعادة ضبط", "Apply": "تطبيق",
    "Refine edges": "تنقيح الحواف", "Brush size": "حجم الفرشاة", "Edge softness": "تنعيم الحواف",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "استخدم «استعادة» لإرجاع أجزاء العنصر المفقودة و«مسح» لإزالة بقايا الخلفية، ثم اضبط تنعيم الحواف قبل التطبيق. لا يتغير سوى قناع ألفا المحلي.",
  },
  tr: {
    "Keep": "Geri getir", "Remove": "Sil", "Undo": "Geri al", "Reset": "Sıfırla", "Apply": "Uygula",
    "Refine edges": "Kenarları iyileştir", "Brush size": "Fırça boyutu", "Edge softness": "Kenar yumuşaklığı",
    "Use Keep to restore missing subject areas, Remove to erase leftover background, then adjust edge softness before applying. Refinement only changes the local alpha mask.": "Eksik nesne bölümlerini Geri getir ile düzeltin, kalan arka planı Sil ile temizleyin. Uygulamadan önce kenar yumuşaklığını ayarlayın. Yalnızca yerel alfa maskesi değiştirilir.",
  },
}

// Keep the two background-removal modes direct and consistent. Generic
// translation often turns "portrait" into orientation or "object" into a
// grammatical term, which obscures the subject choice users must make.
const backgroundModeOverrides = {
  ja: {
    "Remove Image Background": "画像の背景を削除",
    "One-click background removal for people and objects": "人物・物体の背景をワンクリックで削除",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "モード選択は不要です。画像を端末内に保持したまま、人物、商品、動物、車、家具、隣接する複数の被写体を処理できます。",
    "People and objects": "人物と物体",
    "Choose a background-removal mode": "背景除去モードを選択",
    "Portrait background removal": "人物の背景を削除",
    "General-object background removal": "物体の背景を削除",
    "Portrait and Object Background Removal": "人物・物体の背景削除",
    "Remove object background": "物体の背景を削除",
    "Remove portrait background": "人物の背景を削除",
    "General object": "物体", "Portrait": "人物",
    "Fast setup · about 4.6 MB initially": "高速準備 · 初回約4.6 MB",
    "Fast setup · about 7–13 MB": "高速処理 · 約7〜13 MB",
    "Unavailable on this device": "この端末では利用できません",
    "General-object mode is unavailable": "物体モードは利用できません",
  },
  ko: {
    "Remove Image Background": "이미지 배경 제거",
    "One-click background removal for people and objects": "인물과 사물 배경을 한 번에 제거",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "모드를 선택할 필요가 없습니다. 이미지를 기기에 유지한 채 인물, 상품, 동물, 차량, 가구, 서로 인접한 여러 피사체를 처리합니다.",
    "People and objects": "인물과 사물",
    "Choose a background-removal mode": "배경 제거 모드 선택",
    "Portrait background removal": "인물 배경 제거",
    "General-object background removal": "사물 배경 제거",
    "Portrait and Object Background Removal": "인물 및 사물 배경 제거",
    "Remove object background": "사물 배경 제거",
    "Remove portrait background": "인물 배경 제거",
    "General object": "사물", "Portrait": "인물",
    "Fast setup · about 4.6 MB initially": "빠른 준비 · 최초 약 4.6MB",
    "Fast setup · about 7–13 MB": "빠른 준비 · 약 7~13MB",
    "Unavailable on this device": "이 기기에서는 사용할 수 없음",
    "General-object mode is unavailable": "사물 모드 사용 불가",
  },
  es: {
    "Remove Image Background": "Quitar el fondo de una imagen",
    "One-click background removal for people and objects": "Quita el fondo de personas y objetos con un clic",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "No necesitas elegir un modo. Procesa personas, productos, animales, vehículos, muebles y varios sujetos próximos sin sacar la imagen de este dispositivo.",
    "People and objects": "Personas y objetos",
    "Choose a background-removal mode": "Elegir modo de eliminación de fondo",
    "Portrait background removal": "Eliminar fondo de retratos",
    "General-object background removal": "Eliminar fondo de objetos",
    "Portrait and Object Background Removal": "Eliminación de fondo de retratos y objetos",
    "Remove object background": "Eliminar fondo del objeto",
    "Remove portrait background": "Eliminar fondo del retrato",
    "General object": "Objeto", "Portrait": "Retrato",
    "Fast setup · about 4.6 MB initially": "Preparación rápida · unos 4,6 MB la primera vez",
    "Fast setup · about 7–13 MB": "Preparación rápida · unos 7–13 MB",
    "Unavailable on this device": "No disponible en este dispositivo",
    "General-object mode is unavailable": "Modo para objetos no disponible",
  },
  pt: {
    "Remove Image Background": "Remover o fundo da imagem",
    "One-click background removal for people and objects": "Remova o fundo de pessoas e objetos com um clique",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Não é preciso escolher um modo. Processa pessoas, produtos, animais, veículos, móveis e vários elementos próximos sem retirar a imagem deste dispositivo.",
    "People and objects": "Pessoas e objetos",
    "Choose a background-removal mode": "Escolher modo de remoção de fundo",
    "Portrait background removal": "Remover fundo de retratos",
    "General-object background removal": "Remover fundo de objetos",
    "Portrait and Object Background Removal": "Remoção de fundo de retratos e objetos",
    "Remove object background": "Remover fundo do objeto",
    "Remove portrait background": "Remover fundo do retrato",
    "General object": "Objeto", "Portrait": "Retrato",
    "Fast setup · about 4.6 MB initially": "Preparação rápida · cerca de 4,6 MB na primeira utilização",
    "Fast setup · about 7–13 MB": "Preparação rápida · cerca de 7–13 MB",
    "Unavailable on this device": "Não disponível neste dispositivo",
    "General-object mode is unavailable": "Modo de objetos indisponível",
  },
  id: {
    "Remove Image Background": "Hapus latar belakang gambar",
    "One-click background removal for people and objects": "Hapus latar orang dan objek dengan satu klik",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Tidak perlu memilih mode. Proses orang, produk, hewan, kendaraan, furnitur, dan beberapa subjek yang berdekatan tanpa mengirim gambar dari perangkat ini.",
    "People and objects": "Orang dan objek",
    "Choose a background-removal mode": "Pilih mode penghapusan latar",
    "Portrait background removal": "Hapus latar potret",
    "General-object background removal": "Hapus latar objek",
    "Portrait and Object Background Removal": "Penghapusan Latar Potret dan Objek",
    "Remove object background": "Hapus latar objek",
    "Remove portrait background": "Hapus latar potret",
    "General object": "Objek", "Portrait": "Potret",
    "Fast setup · about 4.6 MB initially": "Penyiapan cepat · sekitar 4,6 MB saat pertama kali",
    "Fast setup · about 7–13 MB": "Penyiapan cepat · sekitar 7–13 MB",
    "Unavailable on this device": "Tidak tersedia di perangkat ini",
    "General-object mode is unavailable": "Mode objek tidak tersedia",
  },
  de: {
    "Remove Image Background": "Bildhintergrund entfernen",
    "One-click background removal for people and objects": "Hintergrund von Personen und Objekten mit einem Klick entfernen",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Keine Moduswahl nötig. Verarbeitet Personen, Produkte, Tiere, Fahrzeuge, Möbel und mehrere benachbarte Motive, während das Bild auf diesem Gerät bleibt.",
    "People and objects": "Personen und Objekte",
    "Choose a background-removal mode": "Modus zur Hintergrundentfernung wählen",
    "Portrait background removal": "Porträthintergrund entfernen",
    "General-object background removal": "Objekthintergrund entfernen",
    "Portrait and Object Background Removal": "Hintergrundentfernung für Porträts und Objekte",
    "Remove object background": "Objekthintergrund entfernen",
    "Remove portrait background": "Porträthintergrund entfernen",
    "General object": "Objekt", "Portrait": "Porträt",
    "Fast setup · about 4.6 MB initially": "Schnelle Einrichtung · beim ersten Mal etwa 4,6 MB",
    "Fast setup · about 7–13 MB": "Schnelle Einrichtung · etwa 7–13 MB",
    "Unavailable on this device": "Auf diesem Gerät nicht verfügbar",
    "General-object mode is unavailable": "Objektmodus nicht verfügbar",
  },
  pl: {
    "Remove Image Background": "Usuń tło obrazu",
    "One-click background removal for people and objects": "Usuń tło osób i obiektów jednym kliknięciem",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Nie musisz wybierać trybu. Przetwarza osoby, produkty, zwierzęta, pojazdy, meble i kilka sąsiadujących obiektów, pozostawiając obraz na tym urządzeniu.",
    "People and objects": "Osoby i obiekty",
    "Choose a background-removal mode": "Wybierz tryb usuwania tła",
    "Portrait background removal": "Usuń tło portretu",
    "General-object background removal": "Usuń tło obiektu",
    "Portrait and Object Background Removal": "Usuwanie tła portretów i obiektów",
    "Remove object background": "Usuń tło obiektu",
    "Remove portrait background": "Usuń tło portretu",
    "General object": "Obiekt", "Portrait": "Portret",
    "Fast setup · about 4.6 MB initially": "Szybkie przygotowanie · około 4,6 MB przy pierwszym użyciu",
    "Fast setup · about 7–13 MB": "Szybkie przygotowanie · około 7–13 MB",
    "Unavailable on this device": "Niedostępne na tym urządzeniu",
    "General-object mode is unavailable": "Tryb obiektów jest niedostępny",
  },
  ru: {
    "Remove Image Background": "Удалить фон изображения",
    "One-click background removal for people and objects": "Удаление фона людей и объектов в один клик",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Выбирать режим не нужно. Обрабатывает людей, товары, животных, транспорт, мебель и несколько соседних объектов, не отправляя изображение с устройства.",
    "People and objects": "Люди и объекты",
    "Choose a background-removal mode": "Выберите режим удаления фона",
    "Portrait background removal": "Удаление фона портрета",
    "General-object background removal": "Удаление фона объекта",
    "Portrait and Object Background Removal": "Удаление фона портретов и объектов",
    "Remove object background": "Удалить фон объекта",
    "Remove portrait background": "Удалить фон портрета",
    "General object": "Объект", "Portrait": "Портрет",
    "Fast setup · about 4.6 MB initially": "Быстрая подготовка · около 4,6 МБ при первом запуске",
    "Fast setup · about 7–13 MB": "Быстрая подготовка · около 7–13 МБ",
    "Unavailable on this device": "Недоступно на этом устройстве",
    "General-object mode is unavailable": "Режим объектов недоступен",
  },
  fr: {
    "Remove Image Background": "Supprimer l’arrière-plan d’une image",
    "One-click background removal for people and objects": "Supprimez l’arrière-plan des personnes et des objets en un clic",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Aucun mode à choisir. Traite les personnes, produits, animaux, véhicules, meubles et plusieurs sujets proches sans envoyer l’image hors de cet appareil.",
    "People and objects": "Personnes et objets",
    "Choose a background-removal mode": "Choisir un mode de suppression de l’arrière-plan",
    "Portrait background removal": "Supprimer l’arrière-plan d’un portrait",
    "General-object background removal": "Supprimer l’arrière-plan d’un objet",
    "Portrait and Object Background Removal": "Suppression de l’arrière-plan des portraits et des objets",
    "Remove object background": "Supprimer l’arrière-plan de l’objet",
    "Remove portrait background": "Supprimer l’arrière-plan du portrait",
    "General object": "Objet", "Portrait": "Portrait",
    "Fast setup · about 4.6 MB initially": "Préparation rapide · environ 4,6 Mo lors de la première utilisation",
    "Fast setup · about 7–13 MB": "Préparation rapide · environ 7–13 Mo",
    "Unavailable on this device": "Non disponible sur cet appareil",
    "General-object mode is unavailable": "Mode objets indisponible",
  },
  ar: {
    "Remove Image Background": "إزالة خلفية الصورة",
    "One-click background removal for people and objects": "إزالة خلفية الأشخاص والعناصر بنقرة واحدة",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "لا حاجة لاختيار وضع. يعالج الأشخاص والمنتجات والحيوانات والمركبات والأثاث وعدة عناصر متجاورة مع بقاء الصورة على هذا الجهاز.",
    "People and objects": "الأشخاص والعناصر",
    "Choose a background-removal mode": "اختر وضع إزالة الخلفية",
    "Portrait background removal": "إزالة خلفية الصور الشخصية",
    "General-object background removal": "إزالة خلفية العناصر",
    "Portrait and Object Background Removal": "إزالة خلفيات الصور الشخصية والعناصر",
    "Remove object background": "إزالة خلفية العنصر",
    "Remove portrait background": "إزالة خلفية الصورة الشخصية",
    "General object": "عنصر", "Portrait": "صورة شخصية",
    "Fast setup · about 4.6 MB initially": "إعداد سريع · نحو 4.6 ميجابايت عند الاستخدام الأول",
    "Fast setup · about 7–13 MB": "إعداد سريع · نحو 7–13 ميجابايت",
    "Unavailable on this device": "غير متاح على هذا الجهاز",
    "General-object mode is unavailable": "وضع العناصر غير متاح",
  },
  tr: {
    "Remove Image Background": "Görsel arka planını kaldır",
    "One-click background removal for people and objects": "İnsanların ve nesnelerin arka planını tek tıkla kaldır",
    "No mode selection needed. Works with people, products, animals, vehicles, furniture, and adjacent subjects while keeping the image on this device.": "Mod seçmeniz gerekmez. Görseli bu cihazda tutarak insanları, ürünleri, hayvanları, araçları, mobilyaları ve yan yana birden çok özneyi işler.",
    "People and objects": "İnsanlar ve nesneler",
    "Choose a background-removal mode": "Arka plan kaldırma modunu seçin",
    "Portrait background removal": "Portre arka planını kaldır",
    "General-object background removal": "Nesne arka planını kaldır",
    "Portrait and Object Background Removal": "Portre ve Nesne Arka Plan Kaldırma",
    "Remove object background": "Nesne arka planını kaldır",
    "Remove portrait background": "Portre arka planını kaldır",
    "General object": "Nesne", "Portrait": "Portre",
    "Fast setup · about 4.6 MB initially": "Hızlı hazırlık · ilk kullanımda yaklaşık 4,6 MB",
    "Fast setup · about 7–13 MB": "Hızlı hazırlık · yaklaşık 7–13 MB",
    "Unavailable on this device": "Bu cihazda mevcut değil",
    "General-object mode is unavailable": "Nesne modu kullanılamıyor",
  },
}

// Image-editing terminology is highly contextual: generic machine translation
// often interprets "crop" as agriculture and "redaction" as copy editing.
// Keep the visible editor actions reviewed and stable in every locale.
const imageEditorOverrides = {
  ja: {
    "Quick Image Editing, Annotation, and Redaction": "かんたん画像編集・注釈・情報隠し",
    "Crop": "切り抜き",
    "Crop ratio": "切り抜き比率",
    "Apply crop": "切り抜きを適用",
    "Crop and orient": "切り抜きと向きの調整",
    "Mosaic": "モザイク",
    "The crop area is too small. Enlarge the selection.": "切り抜き範囲が小さすぎます。選択範囲を広げてください。",
  },
  ko: {
    "Quick Image Editing, Annotation, and Redaction": "빠른 이미지 편집, 주석 및 정보 가리기",
    "Crop": "자르기",
    "Crop ratio": "자르기 비율",
    "Apply crop": "자르기 적용",
    "Crop and orient": "자르기 및 방향 조정",
    "Mosaic": "모자이크",
    "The crop area is too small. Enlarge the selection.": "자르기 영역이 너무 작습니다. 선택 영역을 넓혀 주세요.",
  },
  es: {
    "Quick Image Editing, Annotation, and Redaction": "Edición rápida de imágenes, anotación y ocultación",
    "Crop": "Recortar",
    "Crop ratio": "Proporción de recorte",
    "Apply crop": "Aplicar recorte",
    "Crop and orient": "Recortar y orientar",
    "Mosaic": "Pixelar",
    "The crop area is too small. Enlarge the selection.": "El área de recorte es demasiado pequeña. Amplía la selección.",
  },
  pt: {
    "Quick Image Editing, Annotation, and Redaction": "Edição rápida de imagens, anotação e ocultação",
    "Crop": "Recortar",
    "Crop ratio": "Proporção do recorte",
    "Apply crop": "Aplicar recorte",
    "Crop and orient": "Recortar e orientar",
    "Mosaic": "Pixelizar",
    "The crop area is too small. Enlarge the selection.": "A área de recorte é demasiado pequena. Aumente a seleção.",
  },
  id: {
    "Quick Image Editing, Annotation, and Redaction": "Edit Gambar Cepat, Anotasi, dan Penyensoran",
    "Crop": "Pangkas",
    "Crop ratio": "Rasio pangkas",
    "Apply crop": "Terapkan pangkasan",
    "Crop and orient": "Pangkas dan atur orientasi",
    "Mosaic": "Pikselasi",
    "The crop area is too small. Enlarge the selection.": "Area pangkas terlalu kecil. Perbesar area pilihan.",
  },
  de: {
    "Quick Image Editing, Annotation, and Redaction": "Schnelle Bildbearbeitung, Anmerkungen und Verpixelung",
    "Crop": "Zuschneiden",
    "Crop ratio": "Seitenverhältnis beim Zuschneiden",
    "Apply crop": "Zuschnitt anwenden",
    "Crop and orient": "Zuschneiden und ausrichten",
    "Mosaic": "Verpixeln",
    "The crop area is too small. Enlarge the selection.": "Der Zuschneidebereich ist zu klein. Vergrößere die Auswahl.",
  },
  pl: {
    "Quick Image Editing, Annotation, and Redaction": "Szybka edycja obrazów, adnotacje i ukrywanie danych",
    "Crop": "Przytnij",
    "Crop ratio": "Proporcje kadrowania",
    "Apply crop": "Zastosuj przycięcie",
    "Crop and orient": "Przytnij i ustaw orientację",
    "Mosaic": "Pikselizacja",
    "The crop area is too small. Enlarge the selection.": "Obszar przycięcia jest zbyt mały. Powiększ zaznaczenie.",
  },
  ru: {
    "Quick Image Editing, Annotation, and Redaction": "Быстрое редактирование, аннотации и скрытие данных",
    "Crop": "Обрезать",
    "Crop ratio": "Пропорции обрезки",
    "Apply crop": "Применить обрезку",
    "Crop and orient": "Обрезка и ориентация",
    "Mosaic": "Пикселизация",
    "The crop area is too small. Enlarge the selection.": "Область обрезки слишком мала. Увеличьте выделение.",
  },
  fr: {
    "Quick Image Editing, Annotation, and Redaction": "Retouche rapide, annotations et masquage",
    "Crop": "Recadrer",
    "Crop ratio": "Proportions du recadrage",
    "Apply crop": "Appliquer le recadrage",
    "Crop and orient": "Recadrer et orienter",
    "Mosaic": "Pixelliser",
    "The crop area is too small. Enlarge the selection.": "La zone de recadrage est trop petite. Agrandissez la sélection.",
  },
  ar: {
    "Quick Image Editing, Annotation, and Redaction": "تحرير سريع للصور وإضافة التعليقات وحجب المعلومات",
    "Crop": "اقتصاص",
    "Crop ratio": "نسبة الاقتصاص",
    "Apply crop": "تطبيق الاقتصاص",
    "Crop and orient": "الاقتصاص وضبط الاتجاه",
    "Mosaic": "تمويه بالبكسل",
    "The crop area is too small. Enlarge the selection.": "منطقة الاقتصاص صغيرة جدًا. وسّع التحديد.",
  },
  tr: {
    "Quick Image Editing, Annotation, and Redaction": "Hızlı Görsel Düzenleme, Açıklama ve Gizleme",
    "Crop": "Kırp",
    "Crop ratio": "Kırpma oranı",
    "Apply crop": "Kırpmayı uygula",
    "Crop and orient": "Kırp ve yönü ayarla",
    "Mosaic": "Pikselleştir",
    "The crop area is too small. Enlarge the selection.": "Kırpma alanı çok küçük. Seçimi büyütün.",
  },
}

// Batch queues use product-specific wording. Keep ZIP as a file format (not a
// postal code) and describe the select-edit-save-next workflow consistently.
const batchQueueOverrides = {
  ja: {
    "Batch background removal": "画像の背景を一括削除",
    "Quick-edit queue": "クイック編集キュー",
    "Save to queue": "キューに保存",
    "Current edits are not saved to the queue. Switch images anyway?": "現在の編集はキューに保存されていません。それでも画像を切り替えますか？",
    "Download edited ZIP": "編集済み画像をZIPでダウンロード",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "複数の画像を追加し、キューから1枚を選んで編集します。結果をキューに保存してから、次の画像に進みます。",
  },
  ko: {
    "Batch background removal": "이미지 배경 일괄 제거",
    "Quick-edit queue": "빠른 편집 대기열",
    "Save to queue": "대기열에 저장",
    "Current edits are not saved to the queue. Switch images anyway?": "현재 편집 내용이 대기열에 저장되지 않았습니다. 그래도 이미지를 전환할까요?",
    "Download edited ZIP": "편집된 이미지 ZIP 다운로드",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "여러 이미지를 추가하고 대기열에서 한 장을 선택해 편집하세요. 결과를 대기열에 저장한 다음 다음 이미지로 이동합니다.",
  },
  es: {
    "Batch background removal": "Eliminar fondos por lotes",
    "Quick-edit queue": "Cola de edición rápida",
    "Save to queue": "Guardar en la cola",
    "Current edits are not saved to the queue. Switch images anyway?": "Los cambios actuales no están guardados en la cola. ¿Quieres cambiar de imagen de todos modos?",
    "Download edited ZIP": "Descargar ZIP de imágenes editadas",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Añade varias imágenes, selecciona una de la cola para editarla, guarda el resultado en la cola y continúa con la siguiente imagen.",
  },
  pt: {
    "Batch background removal": "Remover fundos em lote",
    "Quick-edit queue": "Fila de edição rápida",
    "Save to queue": "Guardar na fila",
    "Current edits are not saved to the queue. Switch images anyway?": "As alterações atuais não foram guardadas na fila. Mudar de imagem mesmo assim?",
    "Download edited ZIP": "Transferir ZIP das imagens editadas",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Adicione várias imagens, selecione uma da fila para editar, guarde o resultado na fila e avance para a imagem seguinte.",
  },
  id: {
    "Batch background removal": "Hapus latar belakang secara massal",
    "Quick-edit queue": "Antrean edit cepat",
    "Save to queue": "Simpan ke antrean",
    "Current edits are not saved to the queue. Switch images anyway?": "Perubahan saat ini belum disimpan ke antrean. Tetap ganti gambar?",
    "Download edited ZIP": "Unduh ZIP gambar yang diedit",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Tambahkan beberapa gambar, pilih satu dari antrean untuk diedit, simpan hasilnya ke antrean, lalu lanjutkan ke gambar berikutnya.",
  },
  de: {
    "Batch background removal": "Hintergründe stapelweise entfernen",
    "Quick-edit queue": "Warteschlange für Schnellbearbeitung",
    "Save to queue": "In Warteschlange speichern",
    "Current edits are not saved to the queue. Switch images anyway?": "Die aktuellen Änderungen sind nicht in der Warteschlange gespeichert. Trotzdem das Bild wechseln?",
    "Download edited ZIP": "ZIP mit bearbeiteten Bildern herunterladen",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Füge mehrere Bilder hinzu, wähle eines aus der Warteschlange zur Bearbeitung aus, speichere das Ergebnis und fahre dann mit dem nächsten Bild fort.",
  },
  pl: {
    "Batch background removal": "Wsadowe usuwanie tła",
    "Quick-edit queue": "Kolejka szybkiej edycji",
    "Save to queue": "Zapisz w kolejce",
    "Current edits are not saved to the queue. Switch images anyway?": "Bieżące zmiany nie zostały zapisane w kolejce. Mimo to przełączyć obraz?",
    "Download edited ZIP": "Pobierz ZIP z edytowanymi obrazami",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Dodaj wiele obrazów, wybierz jeden z kolejki do edycji, zapisz wynik w kolejce, a następnie przejdź do kolejnego obrazu.",
  },
  ru: {
    "Batch background removal": "Пакетное удаление фона",
    "Quick-edit queue": "Очередь быстрого редактирования",
    "Save to queue": "Сохранить в очередь",
    "Current edits are not saved to the queue. Switch images anyway?": "Текущие изменения не сохранены в очереди. Всё равно сменить изображение?",
    "Download edited ZIP": "Скачать ZIP с отредактированными изображениями",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Добавьте несколько изображений, выберите одно из очереди для редактирования, сохраните результат и перейдите к следующему изображению.",
  },
  fr: {
    "Batch background removal": "Suppression d’arrière-plan par lot",
    "Quick-edit queue": "File d’attente de retouche rapide",
    "Save to queue": "Enregistrer dans la file d’attente",
    "Current edits are not saved to the queue. Switch images anyway?": "Les modifications actuelles ne sont pas enregistrées dans la file. Changer quand même d’image ?",
    "Download edited ZIP": "Télécharger le ZIP des images modifiées",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Ajoutez plusieurs images, sélectionnez-en une dans la file pour la modifier, enregistrez le résultat, puis passez à l’image suivante.",
  },
  ar: {
    "Batch background removal": "إزالة الخلفيات دفعة واحدة",
    "Quick-edit queue": "قائمة انتظار التعديل السريع",
    "Save to queue": "حفظ في قائمة الانتظار",
    "Current edits are not saved to the queue. Switch images anyway?": "لم تُحفظ التعديلات الحالية في قائمة الانتظار. هل تريد تبديل الصورة رغم ذلك؟",
    "Download edited ZIP": "تنزيل ملف ZIP للصور المعدلة",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "أضف عدة صور، واختر صورة من قائمة الانتظار لتعديلها، ثم احفظ النتيجة وانتقل إلى الصورة التالية.",
  },
  tr: {
    "Batch background removal": "Toplu arka plan kaldırma",
    "Quick-edit queue": "Hızlı düzenleme kuyruğu",
    "Save to queue": "Kuyruğa kaydet",
    "Current edits are not saved to the queue. Switch images anyway?": "Mevcut düzenlemeler kuyruğa kaydedilmedi. Yine de görsel değiştirilsin mi?",
    "Download edited ZIP": "Düzenlenen görsellerin ZIP dosyasını indir",
    "Add multiple images, select one from the queue to edit, save it to the queue, then continue with the next image.": "Birden fazla görsel ekleyin, kuyruktan birini seçip düzenleyin, sonucu kuyruğa kaydedin ve ardından sonraki görsele geçin.",
  },
}

const batchRefinementOverrides = {
  ja: {
    "Click to refine": "クリックして修正",
    "Refine selected image edges": "選択した画像の境界を修正",
    "Applying changes updates the queue preview, individual download, and ZIP.": "変更を適用すると、キューのプレビュー、個別ダウンロード、ZIPが更新されます。",
    "Edge refinements were saved to this queue item.": "境界の修正をこのキュー項目に保存しました。",
    "Refine background edges for {name}": "「{name}」の背景境界を修正",
    "Close edge refinement": "境界修正を閉じる",
    "Edge refinement for selected image": "選択した画像の境界修正",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "透明結果はダウンロードできますが、この画像は同じタブで境界を修正するには大きすぎます。先に画像サイズを縮小してください。",
  },
  ko: {
    "Click to refine": "클릭하여 다듬기",
    "Refine selected image edges": "선택한 이미지 가장자리 다듬기",
    "Applying changes updates the queue preview, individual download, and ZIP.": "변경 사항을 적용하면 대기열 미리보기, 개별 다운로드 및 ZIP이 업데이트됩니다.",
    "Edge refinements were saved to this queue item.": "가장자리 수정 내용을 이 대기열 항목에 저장했습니다.",
    "Refine background edges for {name}": "{name}의 배경 가장자리 다듬기",
    "Close edge refinement": "가장자리 다듬기 닫기",
    "Edge refinement for selected image": "선택한 이미지 가장자리 다듬기",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "투명 결과는 다운로드할 수 있지만 이 이미지는 같은 탭에서 가장자리를 다듬기에는 너무 큽니다. 먼저 이미지 크기를 줄이세요.",
  },
  es: {
    "Click to refine": "Haz clic para corregir",
    "Refine selected image edges": "Corregir bordes de la imagen seleccionada",
    "Applying changes updates the queue preview, individual download, and ZIP.": "Al aplicar los cambios se actualizan la vista previa de la cola, la descarga individual y el ZIP.",
    "Edge refinements were saved to this queue item.": "Las correcciones de bordes se guardaron en este elemento de la cola.",
    "Refine background edges for {name}": "Corregir los bordes del fondo de {name}",
    "Close edge refinement": "Cerrar corrección de bordes",
    "Edge refinement for selected image": "Corrección de bordes de la imagen seleccionada",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "El resultado transparente se puede descargar, pero esta imagen es demasiado grande para corregir sus bordes en la misma pestaña. Reduce primero sus dimensiones.",
  },
  pt: {
    "Click to refine": "Clique para corrigir",
    "Refine selected image edges": "Corrigir contornos da imagem selecionada",
    "Applying changes updates the queue preview, individual download, and ZIP.": "Ao aplicar as alterações, a pré-visualização da fila, a transferência individual e o ZIP são atualizados.",
    "Edge refinements were saved to this queue item.": "As correções de contorno foram guardadas neste item da fila.",
    "Refine background edges for {name}": "Corrigir os contornos do fundo de {name}",
    "Close edge refinement": "Fechar correção de contornos",
    "Edge refinement for selected image": "Correção de contornos da imagem selecionada",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "O resultado transparente pode ser transferido, mas esta imagem é demasiado grande para corrigir os contornos no mesmo separador. Reduza primeiro as dimensões.",
  },
  id: {
    "Click to refine": "Klik untuk memperbaiki tepi",
    "Refine selected image edges": "Perbaiki tepi gambar yang dipilih",
    "Applying changes updates the queue preview, individual download, and ZIP.": "Menerapkan perubahan akan memperbarui pratinjau antrean, unduhan satuan, dan ZIP.",
    "Edge refinements were saved to this queue item.": "Perbaikan tepi disimpan ke item antrean ini.",
    "Refine background edges for {name}": "Perbaiki tepi latar belakang {name}",
    "Close edge refinement": "Tutup perbaikan tepi",
    "Edge refinement for selected image": "Perbaikan tepi gambar yang dipilih",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "Hasil transparan tetap dapat diunduh, tetapi gambar ini terlalu besar untuk diperbaiki tepinya di tab yang sama. Kecilkan dimensinya terlebih dahulu.",
  },
  de: {
    "Click to refine": "Zum Nachbessern klicken",
    "Refine selected image edges": "Kanten des ausgewählten Bildes nachbessern",
    "Applying changes updates the queue preview, individual download, and ZIP.": "Beim Anwenden werden Warteschlangenvorschau, Einzeldownload und ZIP aktualisiert.",
    "Edge refinements were saved to this queue item.": "Die Kantennachbesserungen wurden in diesem Warteschlangeneintrag gespeichert.",
    "Refine background edges for {name}": "Hintergrundkanten von {name} nachbessern",
    "Close edge refinement": "Kantennachbesserung schließen",
    "Edge refinement for selected image": "Kantennachbesserung für das ausgewählte Bild",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "Das transparente Ergebnis kann weiterhin heruntergeladen werden, aber dieses Bild ist für eine Kantennachbesserung im selben Tab zu groß. Verkleinere zuerst die Bildabmessungen.",
  },
  pl: {
    "Click to refine": "Kliknij, aby poprawić krawędzie",
    "Refine selected image edges": "Popraw krawędzie wybranego obrazu",
    "Applying changes updates the queue preview, individual download, and ZIP.": "Zastosowanie zmian aktualizuje podgląd kolejki, pobieranie pojedynczego pliku i archiwum ZIP.",
    "Edge refinements were saved to this queue item.": "Poprawki krawędzi zapisano w tym elemencie kolejki.",
    "Refine background edges for {name}": "Popraw krawędzie tła obrazu {name}",
    "Close edge refinement": "Zamknij poprawianie krawędzi",
    "Edge refinement for selected image": "Poprawianie krawędzi wybranego obrazu",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "Przezroczysty wynik nadal można pobrać, ale obraz jest zbyt duży, aby poprawiać krawędzie w tej samej karcie. Najpierw zmniejsz jego wymiary.",
  },
  ru: {
    "Click to refine": "Нажмите, чтобы поправить края",
    "Refine selected image edges": "Поправить края выбранного изображения",
    "Applying changes updates the queue preview, individual download, and ZIP.": "После применения изменений обновятся предпросмотр в очереди, отдельный файл и ZIP-архив.",
    "Edge refinements were saved to this queue item.": "Исправления краёв сохранены в этом элементе очереди.",
    "Refine background edges for {name}": "Поправить края фона у {name}",
    "Close edge refinement": "Закрыть коррекцию краёв",
    "Edge refinement for selected image": "Коррекция краёв выбранного изображения",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "Прозрачный результат можно скачать, но изображение слишком большое для коррекции краёв в этой вкладке. Сначала уменьшите его размеры.",
  },
  fr: {
    "Click to refine": "Cliquer pour corriger",
    "Refine selected image edges": "Corriger les contours de l’image sélectionnée",
    "Applying changes updates the queue preview, individual download, and ZIP.": "L’application des modifications met à jour l’aperçu de la file, le téléchargement individuel et le fichier ZIP.",
    "Edge refinements were saved to this queue item.": "Les corrections de contours ont été enregistrées dans cet élément de la file.",
    "Refine background edges for {name}": "Corriger les contours de l’arrière-plan de {name}",
    "Close edge refinement": "Fermer la correction des contours",
    "Edge refinement for selected image": "Correction des contours de l’image sélectionnée",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "Le résultat transparent reste téléchargeable, mais cette image est trop grande pour corriger ses contours dans le même onglet. Réduisez d’abord ses dimensions.",
  },
  ar: {
    "Click to refine": "انقر لتصحيح الحواف",
    "Refine selected image edges": "تصحيح حواف الصورة المحددة",
    "Applying changes updates the queue preview, individual download, and ZIP.": "عند تطبيق التغييرات، يتم تحديث معاينة قائمة الانتظار والتنزيل الفردي وملف ZIP.",
    "Edge refinements were saved to this queue item.": "تم حفظ تصحيحات الحواف في هذا العنصر من قائمة الانتظار.",
    "Refine background edges for {name}": "تصحيح حواف خلفية {name}",
    "Close edge refinement": "إغلاق تصحيح الحواف",
    "Edge refinement for selected image": "تصحيح حواف الصورة المحددة",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "لا يزال بإمكانك تنزيل النتيجة الشفافة، لكن الصورة كبيرة جدًا لتصحيح حوافها في علامة التبويب نفسها. صغّر أبعادها أولًا.",
  },
  tr: {
    "Click to refine": "Kenarları düzeltmek için tıklayın",
    "Refine selected image edges": "Seçilen görselin kenarlarını düzelt",
    "Applying changes updates the queue preview, individual download, and ZIP.": "Değişiklikler uygulandığında kuyruk önizlemesi, tekil indirme ve ZIP dosyası güncellenir.",
    "Edge refinements were saved to this queue item.": "Kenar düzeltmeleri bu kuyruk öğesine kaydedildi.",
    "Refine background edges for {name}": "{name} görselinin arka plan kenarlarını düzelt",
    "Close edge refinement": "Kenar düzeltmeyi kapat",
    "Edge refinement for selected image": "Seçilen görselin kenarlarını düzeltme",
    "The transparent result is still downloadable, but this image is too large for edge refinement in the same tab. Reduce its dimensions first.": "Şeffaf sonuç indirilebilir, ancak bu görsel aynı sekmede kenar düzeltme için çok büyük. Önce boyutlarını küçültün.",
  },
}

const batchRefinementHintOverrides = {
  ja: {
    "You can refine edges after background removal": "背景を削除した後も境界を修正できます",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "下の透明結果を選択するか、「境界を修正」ボタンを使用すると、被写体の復元、残った背景の削除、境界のぼかしを行えます。変更は個別ダウンロードとZIPに反映されます。",
    "Refine the first result": "最初の結果を修正",
  },
  ko: {
    "You can refine edges after background removal": "배경 제거 후에도 가장자리를 수정할 수 있습니다",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "아래 투명 결과를 선택하거나 ‘가장자리 다듬기’ 버튼을 사용해 피사체를 복원하고 남은 배경을 지우며 가장자리를 부드럽게 할 수 있습니다. 변경 사항은 개별 다운로드와 ZIP에 반영됩니다.",
    "Refine the first result": "첫 번째 결과 다듬기",
  },
  es: {
    "You can refine edges after background removal": "Puedes corregir los bordes después de quitar el fondo",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Selecciona cualquier resultado transparente o usa el botón «Corregir bordes» para recuperar partes del sujeto, borrar restos del fondo y suavizar los bordes. Los cambios se incluyen en las descargas individuales y en el ZIP.",
    "Refine the first result": "Corregir el primer resultado",
  },
  pt: {
    "You can refine edges after background removal": "Pode corrigir os contornos depois de remover o fundo",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Selecione um resultado transparente ou use o botão «Corrigir contornos» para recuperar partes do elemento, apagar restos do fundo e suavizar os contornos. As alterações são incluídas nas transferências individuais e no ZIP.",
    "Refine the first result": "Corrigir o primeiro resultado",
  },
  id: {
    "You can refine edges after background removal": "Anda dapat memperbaiki tepi setelah menghapus latar belakang",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Pilih hasil transparan di bawah atau gunakan tombol ‘Perbaiki tepi’ untuk mengembalikan bagian subjek, menghapus sisa latar belakang, dan melembutkan tepi. Perubahan diterapkan pada unduhan satuan dan ZIP.",
    "Refine the first result": "Perbaiki hasil pertama",
  },
  de: {
    "You can refine edges after background removal": "Nach dem Entfernen des Hintergrunds kannst du die Kanten nachbessern",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Wähle unten ein transparentes Ergebnis oder die Schaltfläche „Kanten nachbessern“, um Motivteile wiederherzustellen, Hintergrundreste zu entfernen und Kanten weicher zu machen. Die Änderungen werden in Einzeldownloads und der ZIP-Datei übernommen.",
    "Refine the first result": "Erstes Ergebnis nachbessern",
  },
  pl: {
    "You can refine edges after background removal": "Po usunięciu tła możesz poprawić krawędzie",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Wybierz przezroczysty wynik poniżej lub użyj przycisku „Popraw krawędzie”, aby przywrócić fragmenty obiektu, usunąć resztki tła i zmiękczyć krawędzie. Zmiany trafią do pojedynczych plików i archiwum ZIP.",
    "Refine the first result": "Popraw pierwszy wynik",
  },
  ru: {
    "You can refine edges after background removal": "После удаления фона можно поправить края",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Выберите прозрачный результат ниже или нажмите «Поправить края», чтобы восстановить части объекта, удалить остатки фона и смягчить края. Изменения попадут в отдельные файлы и ZIP-архив.",
    "Refine the first result": "Поправить первый результат",
  },
  fr: {
    "You can refine edges after background removal": "Vous pouvez corriger les contours après avoir supprimé l’arrière-plan",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Sélectionnez un résultat transparent ci-dessous ou utilisez le bouton « Corriger les contours » pour restaurer des parties du sujet, effacer les restes d’arrière-plan et adoucir les contours. Les modifications sont incluses dans les téléchargements individuels et le fichier ZIP.",
    "Refine the first result": "Corriger le premier résultat",
  },
  ar: {
    "You can refine edges after background removal": "يمكنك تصحيح الحواف بعد إزالة الخلفية",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "اختر أي نتيجة شفافة أدناه أو استخدم زر «تصحيح الحواف» لاستعادة أجزاء من العنصر ومسح بقايا الخلفية وتنعيم الحواف. تُطبّق التغييرات على التنزيلات الفردية وملف ZIP.",
    "Refine the first result": "تصحيح النتيجة الأولى",
  },
  tr: {
    "You can refine edges after background removal": "Arka planı kaldırdıktan sonra kenarları düzeltebilirsiniz",
    "Select any transparent result below, or use its Refine edges button, to restore the subject, erase leftover background, and soften edges. Changes are included in downloads and the ZIP.": "Aşağıdaki şeffaf sonuçlardan birini seçin veya ‘Kenarları düzelt’ düğmesini kullanarak öznenin eksik bölümlerini geri getirin, kalan arka planı silin ve kenarları yumuşatın. Değişiklikler tekil indirmelere ve ZIP dosyasına uygulanır.",
    "Refine the first result": "İlk sonucu düzelt",
  },
}

const batchPipelineOverrides = {
  ja: {
    "Continue to batch quick editing ({count})": "一括クイック編集へ進む（{count}枚）",
    "Continue to batch optimization ({count})": "一括最適化へ進む（{count}枚）",
  },
  ko: {
    "Continue to batch quick editing ({count})": "일괄 빠른 편집으로 계속 ({count}장)",
    "Continue to batch optimization ({count})": "일괄 최적화로 계속 ({count}장)",
  },
  es: {
    "Continue to batch quick editing ({count})": "Continuar con la edición rápida por lotes ({count})",
    "Continue to batch optimization ({count})": "Continuar con la optimización por lotes ({count})",
  },
  pt: {
    "Continue to batch quick editing ({count})": "Continuar para a edição rápida em lote ({count})",
    "Continue to batch optimization ({count})": "Continuar para a otimização em lote ({count})",
  },
  id: {
    "Continue to batch quick editing ({count})": "Lanjut ke edit cepat massal ({count})",
    "Continue to batch optimization ({count})": "Lanjut ke optimasi massal ({count})",
  },
  de: {
    "Continue to batch quick editing ({count})": "Zur Stapel-Schnellbearbeitung ({count})",
    "Continue to batch optimization ({count})": "Zur Stapeloptimierung ({count})",
  },
  pl: {
    "Continue to batch quick editing ({count})": "Przejdź do szybkiej edycji wsadowej ({count})",
    "Continue to batch optimization ({count})": "Przejdź do optymalizacji wsadowej ({count})",
  },
  ru: {
    "Continue to batch quick editing ({count})": "Перейти к пакетному редактированию ({count})",
    "Continue to batch optimization ({count})": "Перейти к пакетной оптимизации ({count})",
  },
  fr: {
    "Continue to batch quick editing ({count})": "Continuer vers la retouche rapide par lot ({count})",
    "Continue to batch optimization ({count})": "Continuer vers l’optimisation par lot ({count})",
  },
  ar: {
    "Continue to batch quick editing ({count})": "المتابعة إلى التعديل السريع للدفعة ({count})",
    "Continue to batch optimization ({count})": "المتابعة إلى تحسين الدفعة ({count})",
  },
  tr: {
    "Continue to batch quick editing ({count})": "Toplu hızlı düzenlemeye geç ({count})",
    "Continue to batch optimization ({count})": "Toplu optimizasyona geç ({count})",
  },
}

const workflowContinuityOverrides = {
  ja: {
    "Three-step local image workflow": "3ステップのローカル画像ワークフロー",
    "One image batch. Three browser steps.": "1つの画像バッチを、ブラウザ内の3ステップで処理。",
    "Start with background removal": "背景削除から始める",
    "Your recent background-removal queue was restored.": "直前の背景削除キューを復元しました。",
    "Select result to refine edges": "結果を選択して境界を修正",
  },
  ko: {
    "Three-step local image workflow": "3단계 로컬 이미지 작업 흐름",
    "One image batch. Three browser steps.": "이미지 한 묶음을 브라우저의 세 단계로 처리하세요.",
    "Start with background removal": "배경 제거부터 시작",
    "Your recent background-removal queue was restored.": "이전 배경 제거 대기열을 복원했습니다.",
    "Select result to refine edges": "결과를 선택해 가장자리 다듬기",
  },
  es: {
    "Three-step local image workflow": "Flujo local de imágenes en tres pasos",
    "One image batch. Three browser steps.": "Un lote de imágenes. Tres pasos en el navegador.",
    "Start with background removal": "Empezar quitando el fondo",
    "Your recent background-removal queue was restored.": "Se ha restaurado la cola anterior de eliminación de fondos.",
    "Select result to refine edges": "Selecciona el resultado para corregir los bordes",
  },
  pt: {
    "Three-step local image workflow": "Fluxo local de imagens em três passos",
    "One image batch. Three browser steps.": "Um lote de imagens. Três passos no navegador.",
    "Start with background removal": "Começar pela remoção do fundo",
    "Your recent background-removal queue was restored.": "A fila anterior de remoção de fundos foi restaurada.",
    "Select result to refine edges": "Selecione o resultado para corrigir os contornos",
  },
  id: {
    "Three-step local image workflow": "Alur gambar lokal tiga langkah",
    "One image batch. Three browser steps.": "Satu kumpulan gambar. Tiga langkah di browser.",
    "Start with background removal": "Mulai dengan menghapus latar belakang",
    "Your recent background-removal queue was restored.": "Antrean penghapusan latar belakang sebelumnya telah dipulihkan.",
    "Select result to refine edges": "Pilih hasil untuk memperbaiki tepi",
  },
  de: {
    "Three-step local image workflow": "Lokaler Bildworkflow in drei Schritten",
    "One image batch. Three browser steps.": "Ein Bildstapel. Drei Schritte im Browser.",
    "Start with background removal": "Mit Hintergrundentfernung starten",
    "Your recent background-removal queue was restored.": "Die vorherige Warteschlange zur Hintergrundentfernung wurde wiederhergestellt.",
    "Select result to refine edges": "Ergebnis auswählen und Kanten nachbessern",
  },
  pl: {
    "Three-step local image workflow": "Lokalny obieg obrazów w trzech krokach",
    "One image batch. Three browser steps.": "Jedna partia obrazów. Trzy kroki w przeglądarce.",
    "Start with background removal": "Zacznij od usuwania tła",
    "Your recent background-removal queue was restored.": "Przywrócono poprzednią kolejkę usuwania tła.",
    "Select result to refine edges": "Wybierz wynik, aby poprawić krawędzie",
  },
  ru: {
    "Three-step local image workflow": "Локальная обработка изображений в три шага",
    "One image batch. Three browser steps.": "Один пакет изображений. Три шага в браузере.",
    "Start with background removal": "Начать с удаления фона",
    "Your recent background-removal queue was restored.": "Предыдущая очередь удаления фона восстановлена.",
    "Select result to refine edges": "Выберите результат, чтобы поправить края",
  },
  fr: {
    "Three-step local image workflow": "Flux local d’images en trois étapes",
    "One image batch. Three browser steps.": "Un lot d’images. Trois étapes dans le navigateur.",
    "Start with background removal": "Commencer par supprimer l’arrière-plan",
    "Your recent background-removal queue was restored.": "La file précédente de suppression d’arrière-plan a été restaurée.",
    "Select result to refine edges": "Sélectionnez le résultat pour corriger les contours",
  },
  ar: {
    "Three-step local image workflow": "سير عمل محلي للصور من ثلاث خطوات",
    "One image batch. Three browser steps.": "دفعة صور واحدة. ثلاث خطوات داخل المتصفح.",
    "Start with background removal": "ابدأ بإزالة الخلفية",
    "Your recent background-removal queue was restored.": "تمت استعادة قائمة انتظار إزالة الخلفية السابقة.",
    "Select result to refine edges": "اختر النتيجة لتصحيح الحواف",
  },
  tr: {
    "Three-step local image workflow": "Üç adımlı yerel görsel iş akışı",
    "One image batch. Three browser steps.": "Tek bir görsel grubu. Tarayıcıda üç adım.",
    "Start with background removal": "Arka plan kaldırmayla başla",
    "Your recent background-removal queue was restored.": "Önceki arka plan kaldırma kuyruğu geri yüklendi.",
    "Select result to refine edges": "Kenarları düzeltmek için sonucu seç",
  },
}

const refinementZoomOverrides = {
  ja: { "Preview zoom": "プレビューの拡大率", "Reset zoom to 100%": "表示倍率を100%に戻す", "Click to reset to 100%": "クリックして100%に戻す", "Zoom in": "拡大", "Zoom out": "縮小" },
  ko: { "Preview zoom": "미리보기 배율", "Reset zoom to 100%": "배율을 100%로 재설정", "Click to reset to 100%": "클릭하여 100%로 재설정", "Zoom in": "확대", "Zoom out": "축소" },
  es: { "Preview zoom": "Zoom de vista previa", "Reset zoom to 100%": "Restablecer zoom al 100 %", "Click to reset to 100%": "Haz clic para restablecer al 100 %", "Zoom in": "Acercar", "Zoom out": "Alejar" },
  pt: { "Preview zoom": "Zoom da pré-visualização", "Reset zoom to 100%": "Repor zoom a 100%", "Click to reset to 100%": "Clique para repor a 100%", "Zoom in": "Ampliar", "Zoom out": "Reduzir" },
  id: { "Preview zoom": "Perbesaran pratinjau", "Reset zoom to 100%": "Atur ulang perbesaran ke 100%", "Click to reset to 100%": "Klik untuk mengatur ulang ke 100%", "Zoom in": "Perbesar", "Zoom out": "Perkecil" },
  de: { "Preview zoom": "Vorschau-Zoom", "Reset zoom to 100%": "Zoom auf 100 % zurücksetzen", "Click to reset to 100%": "Klicken, um auf 100 % zurückzusetzen", "Zoom in": "Vergrößern", "Zoom out": "Verkleinern" },
  pl: { "Preview zoom": "Powiększenie podglądu", "Reset zoom to 100%": "Ustaw powiększenie na 100%", "Click to reset to 100%": "Kliknij, aby ustawić 100%", "Zoom in": "Powiększ", "Zoom out": "Pomniejsz" },
  ru: { "Preview zoom": "Масштаб предпросмотра", "Reset zoom to 100%": "Сбросить масштаб до 100%", "Click to reset to 100%": "Нажмите, чтобы сбросить до 100%", "Zoom in": "Увеличить", "Zoom out": "Уменьшить" },
  fr: { "Preview zoom": "Zoom de l’aperçu", "Reset zoom to 100%": "Réinitialiser le zoom à 100 %", "Click to reset to 100%": "Cliquer pour revenir à 100 %", "Zoom in": "Agrandir", "Zoom out": "Réduire" },
  ar: { "Preview zoom": "تكبير المعاينة", "Reset zoom to 100%": "إعادة التكبير إلى 100٪", "Click to reset to 100%": "انقر للعودة إلى 100٪", "Zoom in": "تكبير", "Zoom out": "تصغير" },
  tr: { "Preview zoom": "Önizleme ölçeği", "Reset zoom to 100%": "Ölçeği %100'e sıfırla", "Click to reset to 100%": "%100'e dönmek için tıklayın", "Zoom in": "Yakınlaştır", "Zoom out": "Uzaklaştır" },
}

console.log(`Generating ${keys.length} static messages for ${targets.length} languages`)
await runWithConcurrency(targets, 1, generateLanguage)
