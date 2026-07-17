import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"
import { Localized } from "@/components/localized"

export const metadata: Metadata = {
  title: "检测与处理方法",
  description: "TabNative 的 AI 文本与图片检测、图片背景移除、C2PA 验证、元数据清理和 AI 可见水印处理方法与限制。",
}

const sections = [
  {
    title: { zh: "AI 文本检测", en: "AI text detection" },
    paragraphs: [{ zh: "英文文本由 Transformers.js 在浏览器 Worker 中运行 ONNX 分类模型。长文本按段落分片，每个片段独立推断，再按字符数加权聚合。结果同时展示片段差异与稳定度。", en: "Transformers.js runs an ONNX classifier for English text inside a browser Worker. Long text is split by paragraph, each segment is analyzed independently, and scores are weighted by character count. Results show segment variation and stability." }],
    bullets: [
      { zh: "当前模型主要针对英文；非英语、短文本、代码和固定模板不适合判断。", en: "The current model primarily targets English; non-English text, short samples, code, and fixed templates are not suitable." },
      { zh: "“AI 风险”不是作者身份，也不能证明文本完全由某个模型生成。", en: "An AI-risk score does not identify an author and cannot prove that a specific model generated the full text." },
      { zh: "改写、翻译和混合写作会改变统计分布。", en: "Rewriting, translation, and mixed authorship change the statistical distribution." },
    ],
  },
  {
    title: { zh: "本地图片背景移除", en: "On-device image background removal" },
    paragraphs: [{ zh: "浏览器 Worker 使用轻量 U²-NetP 统一识别人物、商品、动物、车辆、家具等显著主体。处理优先运行 WebGPU，并在不可用或执行失败时回退到 WASM CPU，生成逐像素 Alpha 蒙版并与原图组合为透明 PNG。", en: "A browser Worker uses lightweight U²-NetP to detect prominent subjects such as people, products, animals, vehicles, and furniture in one flow. Processing prefers WebGPU and falls back to WASM CPU when it is unavailable or fails, producing a per-pixel alpha matte and combining it with the source as a transparent PNG." }],
    bullets: [
      { zh: "无需选择人像或物体模式；同一能力处理头像、全身人物、商品、动物、车辆、家具、植物和多主体图片。", en: "No portrait-or-object mode selection is required; one capability handles headshots, full-body portraits, products, animals, vehicles, furniture, plants, and multi-subject images." },
      { zh: "首次准备约 4.6 MB，不会在页面加载时预取；下载后会校验 SHA-256。", en: "The first run prepares about 4.6 MB without prefetching it on page load, and verifies its SHA-256 after download." },
      { zh: "固定 320×320 蒙版对细发丝、玻璃、烟雾和低对比边缘可能不够精细，可使用本地修边工具补回或擦除。", en: "The fixed 320×320 mask may miss fine hair, glass, smoke, and low-contrast edges; use the local refinement tools to restore or erase those areas." },
      { zh: "模型权重首次下载后进入浏览器缓存；原始图片和输出不会上传。", en: "Model weights enter the browser cache after the first download; source images and outputs are never uploaded." },
    ],
  },
  {
    title: { zh: "AI 图片检测与来源检查", en: "AI image detection and provenance" },
    paragraphs: [{ zh: "检测组合三类独立证据。像素通道使用 MIT 许可的轻量 ViT ONNX 模型，在浏览器 Worker 中分析整图和多个方形区域；可见标记通道检查 Gemini、豆包和即梦等平台角标；来源通道检查文件容器、EXIF/XMP/IPTC 字段与 C2PA Content Credentials。最终结论会分别显示像素分数、区域一致性、可见标记和文件来源信号。", en: "Detection combines three independent evidence types. The pixel channel runs a lightweight MIT-licensed ViT ONNX model in a browser Worker over the full image and multiple square regions. A visible-mark channel checks platform marks from Gemini, Doubao, and Jimeng. The provenance channel checks the file container, EXIF/XMP/IPTC fields, and C2PA Content Credentials. The final readout keeps pixel score, region consistency, visible marks, and file-provenance signals separate." }],
    bullets: [
      { zh: "明确的平台可见标记或生成器元数据属于强来源证据，即使像素模型分数较低也会提高综合 AI 信号。", en: "An explicit platform mark or generator metadata is strong provenance evidence and can raise the combined AI signal even when the pixel-model score is low." },
      { zh: "模型训练数据主要覆盖 Midjourney、Stable Diffusion 与真实图片，模型卡报告的真实场景准确率约为 72%，不能覆盖所有新生成器。", en: "Training mainly covers Midjourney, Stable Diffusion, and real images; the model card reports about 72% accuracy on its real-world set and cannot cover every new generator." },
      { zh: "插画、游戏画面、重压缩图片、局部 AI 编辑和特殊相机处理都可能误判；缺少元数据也不代表图片一定来自相机。", en: "Illustrations, game captures, heavy compression, local AI edits, and unusual camera processing can be misclassified. Missing metadata does not prove a camera origin." },
    ],
  },
  {
    title: { zh: "元数据与 C2PA 清理", en: "Metadata and C2PA cleaning" },
    paragraphs: [
      { zh: "JPEG 通过重写 APP 段，PNG 通过重写 Chunk，WebP 通过重写 RIFF Chunk。工具会比较处理前后的像素载荷 SHA-256；哈希不一致时禁止下载。", en: "JPEG APP segments, PNG chunks, and WebP RIFF chunks are rewritten. The tool compares pixel-payload SHA-256 hashes before and after processing and blocks downloads when they differ." },
      { zh: "清理容器不会删除 SynthID 等像素级不可见水印，也不能保证社交平台不再标记 AI 内容。", en: "Container cleaning does not remove pixel-level invisible watermarks such as SynthID and cannot guarantee that social platforms stop labeling AI content." },
    ],
    bullets: [],
  },
  {
    title: { zh: "3D 模型转换与预览", en: "3D model conversion and preview" },
    paragraphs: [{ zh: "Three.js 在浏览器中解析模型、关联材质与贴图，使用 WebGL 完成交互预览，并通过导出器生成下载文件。GLB 可承载场景层级、材质、贴图和动画；OBJ、STL 与 PLY 主要用于交换几何数据，导出时可能不保留灯光、相机、骨骼、动画或完整材质。", en: "Three.js parses models and related materials or textures in the browser, renders an interactive WebGL preview, and produces downloadable files through its exporters. GLB can carry scene hierarchy, materials, textures, and animation. OBJ, STL, and PLY focus on geometry exchange and may omit lights, cameras, rigs, animation, or complete material data." }],
    bullets: [
      { zh: "glTF、OBJ 的外部 BIN、MTL 和贴图需要与主模型一起选择。", en: "External BIN, MTL, and texture files used by glTF or OBJ must be selected with the main model." },
      { zh: "模型坐标单位不会自动推断或换算；显示的尺寸沿用源文件数值。", en: "Coordinate units are not inferred or converted; displayed dimensions use source-file values." },
      { zh: "解析和渲染受设备显存、浏览器内存与 WebGL 能力限制，超大模型可能无法打开。", en: "Parsing and rendering are limited by device graphics memory, browser memory, and WebGL support. Very large models may not open." },
    ],
  },
]

export default function Page() {
  return <ContentPage eyebrow="Methodology" title={{ zh: "方法、证据与限制", en: "Methods, evidence, and limitations" }} intro={{ zh: "TabNative 把模型推断、文件来源证据和像素处理分开。每项能力都说明能回答什么、不能回答什么。", en: "TabNative separates model inference, file-provenance evidence, and pixel processing. Every capability states what it can and cannot answer." }}>
    {sections.slice(0, 4).map((section) => <MethodSection key={section.title.en} {...section} />)}
    <section>
      <h2><Localized zh="AI 平台可见角标" en="Visible AI platform marks" /></h2>
      <p className="mt-3">
        <Localized zh="Gemini 使用 " en="Gemini uses the browser SDK and reverse alpha blending from " /><a href="https://github.com/GargantuaX/gemini-watermark-remover">GargantuaX/gemini-watermark-remover</a><Localized zh=" 的浏览器 SDK 与反向 Alpha 混合。豆包与即梦参考 " en=". Doubao and Jimeng use browser-side glyph localization inspired by " /><a href="https://github.com/wiltodelta/remove-ai-watermarks">wiltodelta/remove-ai-watermarks</a><Localized zh=" 的字形轮廓定位方法，在浏览器中检测角落文字并使用附近像素修复。自动检测置信度不足时不修改图片；手动框选只处理用户明确选择的区域。" en=", followed by nearby-pixel repair. Auto mode leaves the image unchanged below its confidence threshold; manual mode changes only the region selected by the user." />
      </p>
    </section>
    <MethodSection {...sections[4]} />
  </ContentPage>
}

function MethodSection({ title, paragraphs, bullets }: (typeof sections)[number]) {
  return <section>
    <h2><Localized zh={title.zh} en={title.en} /></h2>
    {paragraphs.map((paragraph) => <p key={paragraph.en} className="mt-3"><Localized zh={paragraph.zh} en={paragraph.en} /></p>)}
    {bullets.length ? <ul className="mt-4">{bullets.map((bullet) => <li key={bullet.en}><Localized zh={bullet.zh} en={bullet.en} /></li>)}</ul> : null}
  </section>
}
