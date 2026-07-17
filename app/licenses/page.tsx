import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"
import { Localized } from "@/components/localized"

export const metadata: Metadata = { title: "开源许可证", description: "TabNative 使用的开源 SDK、模型与许可证清单。" }

const dependencies = [
  ["vinext", "0.0.50", "MIT", "https://github.com/cloudflare/vinext"],
  ["Next.js / React", "16.2 / 19.2", "MIT", "https://github.com/vercel/next.js"],
  ["shadcn/ui", "4.x CLI", "MIT", "https://github.com/shadcn-ui/ui"],
  ["Three.js", "0.185.1", "MIT", "https://github.com/mrdoob/three.js"],
  ["Fabric.js", "7.4.0", "MIT", "https://github.com/fabricjs/fabric.js"],
  ["Transformers.js", "4.2.0", "Apache-2.0", "https://github.com/huggingface/transformers.js"],
  ["ONNX Runtime Web", "1.26 development build", "MIT", "https://github.com/microsoft/onnxruntime"],
  ["TMR AI text detector ONNX", "Hugging Face", "MIT", "https://huggingface.co/onnx-community/tmr-ai-text-detector-ONNX"],
  ["AI image detect distilled ONNX", "14.6M ViT", "MIT", "https://huggingface.co/onnx-community/ai-image-detect-distilled-ONNX"],
  ["U²-NetP foreground segmentation", "Heliosoph/u2net-onnx @ 7fc34dee", "Apache-2.0", "https://huggingface.co/Heliosoph/u2net-onnx"],
  ["@contentauth/c2pa-web", "0.12.1", "MIT", "https://github.com/contentauth/c2pa-js"],
  ["exifr", "7.1.3", "MIT", "https://github.com/MikeKovarik/exifr"],
  ["Gemini watermark remover", "1.0.29", "MIT", "https://github.com/GargantuaX/gemini-watermark-remover"],
  ["Remove AI Watermarks (visible mark profiles)", "reference assets", "Apache-2.0", "https://github.com/wiltodelta/remove-ai-watermarks"],
  ["Lucide", "1.24.0", "ISC", "https://github.com/lucide-icons/lucide"],
  ["PDF.js", "5.x", "Apache-2.0", "https://github.com/mozilla/pdf.js"],
  ["pdf-lib", "1.x", "MIT", "https://github.com/Hopding/pdf-lib"],
  ["SheetJS Community Edition", "0.20.3", "Apache-2.0", "https://git.sheetjs.com/sheetjs/sheetjs"],
  ["node-qrcode", "1.x", "MIT", "https://github.com/soldair/node-qrcode"],
  ["jsQR", "1.x", "Apache-2.0", "https://github.com/cozmo/jsQR"],
  ["Marked", "17.x", "MIT", "https://github.com/markedjs/marked"],
  ["DOMPurify", "3.x", "Apache-2.0 / MPL-2.0", "https://github.com/cure53/DOMPurify"],
  ["gifuct-js", "2.x", "MIT", "https://github.com/matt-way/gifuct-js"],
  ["gifenc", "1.x", "MIT", "https://github.com/mattdesl/gifenc"],
  ["JSZip", "3.x", "MIT / GPL-3.0", "https://github.com/Stuk/jszip"],
  ["SparkMD5", "3.x", "BSD-3-Clause", "https://github.com/satazor/js-spark-md5"],
]

export default function Page() { return <ContentPage eyebrow="Open source" title={{ zh: "许可证与组件", en: "Licenses and components" }} intro={{ zh: "TabNative 优先采用许可证清晰的开源组件，并在生产构建中固定版本、保留相应许可证文本。", en: "TabNative prioritizes clearly licensed open-source components, pins production versions, and retains the corresponding license text." }}>
  <section><h2><Localized zh="运行时与模型" en="Runtime and models" /></h2><LicenseTable /></section>
  <section><h2><Localized zh="模型限制" en="Model limitations" /></h2><p className="mt-3"><Localized zh="推理框架的许可证不自动覆盖所有模型。TabNative 只加载许可证明确的模型，并在功能页面说明训练范围、语言和误判风险。" en="An inference framework license does not automatically cover every model. TabNative loads only models with clear licensing and documents training scope, language coverage, and false-positive risk on the feature page." /></p></section>
</ContentPage> }

function LicenseTable() {
  return <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3"><Localized zh="组件" en="Component" /></th><th className="px-4 py-3"><Localized zh="版本" en="Version" /></th><th className="px-4 py-3"><Localized zh="许可证" en="License" /></th></tr></thead><tbody>{dependencies.map(([name, version, license, href]) => <tr key={name} className="border-t border-slate-100"><td className="px-4 py-3"><a href={href}>{name}</a></td><td className="px-4 py-3">{version}</td><td className="px-4 py-3">{license}</td></tr>)}</tbody></table></div>
}
