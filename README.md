# TabNative

**工具在标签页运行，文件留在你的设备上。**

> Private tools, native to your browser.

TabNative 是一个免登录的浏览器本地工具箱。图片、PDF、文本、音视频、3D 模型和 AI 内容检查优先在用户设备上通过 WebGPU、WebAssembly、Web Worker 与 Canvas 完成。文件不需上传，也不需创建账号。

**在线使用：** [tabnative.modone0622.workers.dev](https://tabnative.modone0622.workers.dev)

## 核心体验

- **本地图片交付流水线**：批量去背景与手动修边 → 批量快速修图 → 统一压缩、转换与 ZIP 交付；
- **AI 内容检查**：文本风险区间、图片像素特征、文件来源、EXIF/XMP/IPTC 与 C2PA 证据；
- **AI 图片隐私处理**：检查或清理 AI 元数据、C2PA、Made with AI 标签信号与可见水印；
- **无需服务器的轻工具**：PDF、二维码、文本、JSON、Markdown、表格、音视频、SVG 与 3D 模型处理；
- **跨语言与个人化**：13 种界面语言、日间/夜间模式、“我的工具”本地收藏与最近使用。

## 已上线功能

- 英文 AI 文本风险检测、分段证据与 JSON 报告；
- AI 图片来源、EXIF/XMP/IPTC 与 C2PA 检查；
- 选择性清理 AI 元数据、C2PA 和 Made with AI 标签信号；
- Gemini 可见角标检测与本地处理；
- JPG/PNG/WebP 压缩、转换、裁切、旋转与目标 KB；
- PDF 合并、拆分、旋转、图片互转；
- 二维码生成识别、文本与 JSON 工作台、文件校验与 Base64；
- Favicon、Markdown、表格、GIF、音频与视频轻处理；
- 密码与 UUID、日期时间、单位比例、颜色、正则与 URL 工具；
- SVG、头像表情、随机分组、计时器和本地屏幕录制；
- “我的工具”本地收藏与最近使用入口；
- 13 种界面语言（英语、简体中文、日语、韩语、西班牙语、葡萄牙语、印尼语、德语、波兰语、俄语、法语、阿拉伯语、土耳其语），阿拉伯语支持 RTL；
- 独立 SEO 页面、方法、隐私、许可证、条款和广告安全占位。

产品扩展与工具目录需求见 [docs/TOOL_EXPANSION_REQUIREMENTS.md](docs/TOOL_EXPANSION_REQUIREMENTS.md)。

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

依赖与模型许可证见站内 `/licenses`，包括 vinext、Next.js、Transformers.js、ONNX Runtime Web、c2pa-web、exifr、PDF.js、Fabric.js 与 Three.js。

## 部署

项目使用 vinext 构建，并部署到 Cloudflare Workers。`wrangler.jsonc` 包含当前 Worker 与静态资源配置。
