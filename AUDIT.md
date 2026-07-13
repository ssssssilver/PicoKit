# LocalProof 第一版审计记录

审计日期：2026-07-13

## 验证结果

- `npx vinext check`：100% compatible，0 issues；
- TypeScript：通过；
- ESLint：通过；
- Vitest：3 个测试文件、10 个测试通过；
- 关键 HTML 渲染：主页和 5 个核心工具路由通过；
- `vinext build`：15 个页面生产构建通过；
- `npm audit`：0 vulnerabilities。

## 依赖安全处理

- `ts-deepmerge` 固定到 8.0.0，修复 C2PA 依赖链中的原型污染问题；
- Cloudflare 开发链覆盖到已修复的 `wrangler`、`miniflare`、`ws`、`esbuild` 和 `undici` 版本；
- Next.js 内置 PostCSS 覆盖到 8.5.10，消除 CSS stringify XSS 公告；
- 开发服务器仅用于本地开发，生产交付使用构建后的 Worker。

## 许可证

- TMR AI text detector ONNX：MIT；
- `@contentauth/c2pa-web`：MIT；
- `@pilio/gemini-watermark-remover`：MIT；
- Transformers.js：Apache-2.0；
- exifr：MIT；
- vinext、Next.js、React 与 shadcn/ui：MIT；
- Lucide：ISC。

完整展示清单位于站内 `/licenses`。

## 客户端资源边界

- C2PA inline WASM 资源约 11.2MB，仅在检测到 C2PA 字节时动态加载；
- Transformers.js WASM 资源约 23.6MB，文本检测首次运行时按需加载；
- 文本模型从 Hugging Face 首次下载并进入浏览器缓存，不进入首屏包；
- 客户端源代码静态检查未发现 `fetch()`、FormData、XMLHttpRequest、sendBeacon 或 axios 上传实现。
