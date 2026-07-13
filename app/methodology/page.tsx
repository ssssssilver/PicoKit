import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"
import { Localized } from "@/components/localized"

export const metadata: Metadata = {
  title: "检测与处理方法",
  description: "PicoKit 的 AI 文本检测、MODNet 人像抠图、C2PA 验证、元数据清理和 Gemini 可见水印处理方法与限制。",
}

export default function Page() {
  return <ContentPage
    eyebrow="Methodology"
    title={{ zh: "方法、证据与限制", en: "Methods, evidence, and limitations" }}
    intro={{ zh: "PicoKit 把模型推断、文件来源证据和像素处理分开。每项能力都说明能回答什么、不能回答什么。", en: "PicoKit separates model inference, file-provenance evidence, and pixel processing. Every capability states what it can and cannot answer." }}
  >
    <Localized
      zh={<>
        <section><h2>AI 文本检测</h2><p className="mt-3">英文文本由 Transformers.js 在浏览器 Worker 中运行 ONNX 分类模型。长文本按段落分片，每个片段独立推断，再按字符数加权聚合。结果同时展示片段差异与稳定度。</p><ul className="mt-4"><li>当前模型主要针对英文；非英语、短文本、代码和固定模板不适合判断。</li><li>“AI 风险”不是作者身份，也不能证明文本完全由某个模型生成。</li><li>改写、翻译和混合写作会改变统计分布。</li></ul></section>
        <section><h2>MODNet 人像背景移除</h2><p className="mt-3">浏览器 Worker 通过 Transformers.js 加载 MODNet 的量化 ONNX 权重，优先使用 WebGPU，并在不可用时回退到 WASM。模型输出逐像素 Alpha 蒙版，再与原图组合为透明 PNG。</p><ul className="mt-4"><li>MODNet 主要针对单人肖像训练，不是通用物体分割模型。</li><li>复杂背景、多人、动物、商品和遮挡边缘可能出现缺失或残留。</li><li>模型权重首次下载后进入浏览器缓存；原始图片和输出不会上传。</li></ul></section>
        <section><h2>AI 图片检测与来源检查</h2><p className="mt-3">检测包含两个独立通道。像素通道使用 MIT 许可的轻量 ViT ONNX 模型，在浏览器 Worker 中分析整图和多个方形区域；来源通道检查文件容器、EXIF/XMP/IPTC 字段与 C2PA Content Credentials。最终结论会同时显示像素分数、区域一致性和来源信号。</p><ul className="mt-4"><li>模型训练数据主要覆盖 Midjourney、Stable Diffusion 与真实图片，模型卡报告的真实场景准确率约为 72%，不能覆盖所有新生成器。</li><li>插画、游戏画面、重压缩图片、局部 AI 编辑和特殊相机处理都可能误判；区域差异较大时会降低可靠度。</li><li>缺少元数据只说明“没有可读取的文件证据”，不代表图片一定来自相机。</li></ul></section>
        <section><h2>元数据与 C2PA 清理</h2><p className="mt-3">JPEG 通过重写 APP 段，PNG 通过重写 Chunk，WebP 通过重写 RIFF Chunk。工具会比较处理前后的像素载荷 SHA-256；哈希不一致时禁止下载。</p><p className="mt-3">清理容器不会删除 SynthID 等像素级不可见水印，也不能保证社交平台不再标记 AI 内容。</p></section>
        <section><h2>Gemini 可见角标</h2><p className="mt-3">使用 <a href="https://github.com/GargantuaX/gemini-watermark-remover">GargantuaX/gemini-watermark-remover</a> 的浏览器 SDK。它根据已知尺寸和局部位置检测半透明角标，并使用反向 Alpha 混合恢复像素；检测置信度不足时安全跳过。</p></section>
      </>}
      en={<>
        <section><h2>AI text detection</h2><p className="mt-3">Transformers.js runs an ONNX classifier for English text inside a browser Worker. Long text is split by paragraph, each segment is inferred independently, and scores are weighted by character count. Results show segment variation and stability.</p><ul className="mt-4"><li>The current model primarily targets English; non-English text, short samples, code, and fixed templates are not suitable.</li><li>An AI-risk score is not an identity judgment and cannot prove that a specific model generated the full text.</li><li>Rewriting, translation, and mixed authorship change the statistical distribution.</li></ul></section>
        <section><h2>MODNet portrait background removal</h2><p className="mt-3">A browser Worker loads quantized MODNet ONNX weights through Transformers.js, preferring WebGPU and falling back to WASM when unavailable. The model produces a per-pixel alpha matte that is combined with the source image as a transparent PNG.</p><ul className="mt-4"><li>MODNet is trained primarily for single-person portraits and is not a general object-segmentation model.</li><li>Complex backgrounds, groups, animals, products, and occluded edges can produce missing areas or residue.</li><li>Model weights enter the browser cache after the first download; source images and outputs are never uploaded.</li></ul></section>
        <section><h2>AI image detection and provenance</h2><p className="mt-3">Detection has two independent channels. The pixel channel runs a lightweight MIT-licensed ViT ONNX model in a browser Worker over the full image and multiple square regions. The provenance channel checks the file container, EXIF/XMP/IPTC fields, and C2PA Content Credentials. The final readout keeps the pixel score, region consistency, and provenance signals separate.</p><ul className="mt-4"><li>Training mainly covers Midjourney, Stable Diffusion, and real images; the model card reports about 72% accuracy on its real-world set and cannot cover every new generator.</li><li>Illustrations, game captures, heavy compression, local AI edits, and unusual camera processing can be misclassified. Large regional differences lower reliability.</li><li>Missing metadata means only that no readable file evidence was found; it does not prove a camera origin.</li></ul></section>
        <section><h2>Metadata and C2PA cleaning</h2><p className="mt-3">JPEG APP segments, PNG chunks, and WebP RIFF chunks are rewritten. The tool compares pixel-payload SHA-256 hashes before and after processing and blocks downloads when they differ.</p><p className="mt-3">Container cleaning does not remove pixel-level invisible watermarks such as SynthID and cannot guarantee that social platforms stop labeling AI content.</p></section>
        <section><h2>Visible Gemini marks</h2><p className="mt-3">The browser SDK from <a href="https://github.com/GargantuaX/gemini-watermark-remover">GargantuaX/gemini-watermark-remover</a> checks known sizes and local positions for semi-transparent corner marks, then restores pixels with reverse alpha blending. It safely skips when confidence is insufficient.</p></section>
      </>}
    />
  </ContentPage>
}
