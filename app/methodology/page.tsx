import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"

export const metadata: Metadata = { title: "检测与处理方法", description: "LocalProof 的 AI 文本检测、C2PA 验证、元数据清理和 Gemini 可见水印处理方法与限制。" }

export default function Page() {
  return <ContentPage eyebrow="Methodology" title="方法、证据与限制" intro="LocalProof 把模型推断、文件来源证据和像素处理分开。每项能力都说明能回答什么、不能回答什么。">
    <section><h2>AI 文本检测</h2><p className="mt-3">英文文本由 Transformers.js 在浏览器 Worker 中运行 ONNX 分类模型。长文本按段落分片，每个片段独立推断，再按字符数加权聚合。结果同时展示片段差异与稳定度。</p><ul className="mt-4"><li>当前模型主要针对英文；非英语、短文本、代码和固定模板不适合判断。</li><li>“AI 风险”不是作者身份，也不能证明文本完全由某个模型生成。</li><li>改写、翻译和混合写作会改变统计分布。</li></ul></section>
    <section><h2>图片来源检查</h2><p className="mt-3">检查分为三层：文件容器、EXIF/XMP/IPTC 字段、C2PA Content Credentials。C2PA 由 Content Authenticity Initiative 的 Web SDK 读取；DigitalSourceType 与生成器参数作为来源信号分组展示。</p><p className="mt-3">缺少这些字段只说明“没有可读取的文件证据”，不代表图片一定来自相机。平台重编码、截图和普通编辑都会删除元数据。</p></section>
    <section><h2>元数据与 C2PA 清理</h2><p className="mt-3">JPEG 通过重写 APP 段，PNG 通过重写 Chunk，WebP 通过重写 RIFF Chunk。工具会比较处理前后的像素载荷 SHA-256；哈希不一致时禁止下载。</p><p className="mt-3">清理容器不会删除 SynthID 等像素级不可见水印，也不能保证社交平台不再标记 AI 内容。</p></section>
    <section><h2>Gemini 可见角标</h2><p className="mt-3">使用 <a href="https://github.com/GargantuaX/gemini-watermark-remover">GargantuaX/gemini-watermark-remover</a> 的浏览器 SDK。它根据已知尺寸和局部位置检测半透明角标，并使用反向 Alpha 混合恢复像素；检测置信度不足时安全跳过。</p></section>
  </ContentPage>
}

