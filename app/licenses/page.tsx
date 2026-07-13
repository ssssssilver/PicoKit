import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"

export const metadata: Metadata = { title: "开源许可证", description: "LocalProof 第一版使用的开源 SDK、模型与许可证清单。" }

const dependencies = [
  ["vinext", "0.0.50", "MIT", "https://github.com/cloudflare/vinext"],
  ["Next.js / React", "16.2 / 19.2", "MIT", "https://github.com/vercel/next.js"],
  ["shadcn/ui", "4.x CLI", "MIT", "https://github.com/shadcn-ui/ui"],
  ["Transformers.js", "4.2.0", "Apache-2.0", "https://github.com/huggingface/transformers.js"],
  ["TMR AI text detector ONNX", "Hugging Face", "MIT", "https://huggingface.co/onnx-community/tmr-ai-text-detector-ONNX"],
  ["@contentauth/c2pa-web", "0.12.1", "MIT", "https://github.com/contentauth/c2pa-js"],
  ["exifr", "7.1.3", "MIT", "https://github.com/MikeKovarik/exifr"],
  ["Gemini watermark remover", "1.0.29", "MIT", "https://github.com/GargantuaX/gemini-watermark-remover"],
  ["Lucide", "1.24.0", "ISC", "https://github.com/lucide-icons/lucide"],
]

export default function Page() { return <ContentPage eyebrow="Open source" title="许可证与组件" intro="第一版优先使用 MIT、Apache-2.0 和 ISC 组件。生产发布会固定版本并保留许可证文本。">
  <section><h2>运行时与模型</h2><div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">组件</th><th className="px-4 py-3">版本</th><th className="px-4 py-3">许可证</th></tr></thead><tbody>{dependencies.map(([name, version, license, href]) => <tr key={name} className="border-t border-slate-100"><td className="px-4 py-3"><a href={href}>{name}</a></td><td className="px-4 py-3">{version}</td><td className="px-4 py-3">{license}</td></tr>)}</tbody></table></div></section>
  <section><h2>模型限制</h2><p className="mt-3">推理框架的许可证不自动覆盖所有模型。LocalProof 只加载许可证明确的模型，并在模型页面说明训练范围、语言和误判风险。</p></section>
</ContentPage> }

