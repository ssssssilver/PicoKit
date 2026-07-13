# PicoKit

PicoKit 是一个免登录、浏览器本地运行的 AI Detector 与图片隐私工具站。文本推理使用用户设备的 WebGPU/WASM；图片检查、元数据清理、水印处理和压缩使用 Worker、WASM 或 Canvas。用户原始内容不发送到服务端。

## 第一版功能

- 英文 AI 文本风险检测、分段证据与 JSON 报告；
- AI 图片来源、EXIF/XMP/IPTC 与 C2PA 检查；
- 选择性清理 AI 元数据、C2PA 和 Made with AI 标签信号；
- Gemini 可见角标检测与本地处理；
- JPG/PNG/WebP 压缩、转换、裁切、旋转与目标 KB；
- 独立 SEO 页面、方法、隐私、许可证、条款和广告安全占位。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

完整验证：

```bash
npm run check
```

`check` 会依次执行 TypeScript、ESLint、Vitest、vinext 生产构建和关键页面服务端渲染测试。

## 隐私边界

应用没有用户内容上传 API。浏览器只会联网下载页面静态资源、开源模型和 WASM 运行时。广告/匿名分析接入时不得获得 File、Blob、Canvas、文本输入、模型输出或内容哈希。

## 主要开源组件

依赖与模型许可证见站内 `/licenses`，包括 vinext、Next.js、Transformers.js、TMR AI text detector、c2pa-web、exifr 和 Gemini watermark remover。
