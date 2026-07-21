import assert from "node:assert/strict"
import test from "node:test"

async function render(pathname = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url)
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`)
  const { default: worker } = await import(workerUrl.href)
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  )
}

test("server-renders Arabic text without mirroring the application shell", async () => {
  const response = await render("/", { cookie: "picokit-language=ar" })
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /<html[^>]*\blang="ar"/)
  assert.match(html, /<html[^>]*\bdir="ltr"/)
  assert.match(html, /<html[^>]*\bdata-language="ar"/)
  assert.match(html, /<html[^>]*\bdata-text-direction="rtl"/)
})

test("server-renders the TabNative homepage and security headers", async () => {
  const response = await render()
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i)
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
  const html = await response.text()
  assert.match(html, /TabNative/)
  assert.match(html, /一批图片，三步完成交付。/)
  const htmlWithoutLegacyRepositoryUrl = html.replaceAll("https://github.com/ssssssilver/PicoKit", "")
  assert.doesNotMatch(htmlWithoutLegacyRepositoryUrl, /PicoKit/)
  assert.match(html, /href="https:\/\/github\.com\/ssssssilver\/PicoKit"/)
  assert.match(html, /lucide-blocks/)
  assert.match(html, /上一项工具能力/)
  assert.match(html, /下一项工具能力/)
  assert.doesNotMatch(html, /暂停自动切换/)
  assert.match(html, /mailto:modone0622@gmail\.com/)
  assert.match(html, /反馈与支持/)
  assert.match(html, /我的工具/)
  assert.match(html, /收藏.*我的工具/)
  assert.match(html, /href="\/#my-tools"/)
  assert.match(html, /id="my-tools"/)
  assert.match(html, /AI 工具导航/)
  const featuredRemovalStart = html.indexOf('<a href="/remove-background"')
  const firstDetectorLink = html.indexOf('<a href="/ai-image-detector"')
  assert.ok(featuredRemovalStart >= 0 && featuredRemovalStart < firstDetectorLink, "the image delivery pipeline should be the first primary tool link")
  assert.match(html.slice(featuredRemovalStart, html.indexOf("</a>", featuredRemovalStart)), /lucide-star/)
  assert.match(html, /批量图片处理/)
  assert.match(html, /PDF 批量处理/)
  assert.doesNotMatch(html, /TabNative 工具首页/)
  assert.doesNotMatch(html, /方法与限制/)
  assert.doesNotMatch(html, /查看方法说明/)
  assert.match(html, /application\/ld\+json/)
  assert.doesNotMatch(html, /Codex is working|Your site is taking shape|react-loading-skeleton/)
})

for (const [pathname, marker] of [
  ["/one-click-ai-cleaner", "ONE-CLICK AI MARK CLEANUP"],
  ["/ai-text-detector", "AI 文本检测"],
  ["/ai-image-detector", "AI 图片检测"],
  ["/remove-ai-metadata-from-image", "清理图片 AI 元数据"],
  ["/remove-c2pa-content-credentials", "C2PA"],
  ["/remove-made-with-ai-label", "Made with AI"],
  ["/gemini-watermark-remover", "AI"],
  ["/image-compressor", "批量图片优化与交付"],
  ["/image-editor", "快速修图、标注与打码"],
  ["/image-wobble-maker", "图片晃动动画"],
  ["/resize-image-to-kb", "把图片压缩到目标大小"],
  ["/remove-background", "批量图片处理"],
  ["/3d-model-converter", "3D 模型格式转换与预览"],
  ["/pdf-tools", "PDF 批量处理"],
  ["/qr-code-tool", "二维码生成与识别"],
  ["/text-tools", "文本统计、清理与编解码"],
  ["/json-tools", "JSON 格式化、校验与转换"],
  ["/file-hash-base64", "文件校验与 Base64"],
  ["/favicon-generator", "Favicon 与应用图标生成器"],
  ["/markdown-editor", "Markdown 编辑、预览与导出"],
  ["/spreadsheet-converter", "表格预览与转换"],
  ["/gif-tools", "GIF 拆帧与图片合成 GIF"],
  ["/audio-tools", "音频裁剪与 WAV 导出"],
  ["/video-tools", "视频取帧与静音片段"],
  ["/password-uuid-generator", "密码与 UUID 生成器"],
  ["/date-time-tools", "日期、时间戳与时区工具"],
  ["/unit-ratio-converter", "单位转换与宽高比计算"],
  ["/color-tools", "颜色、调色板与对比度工具"],
  ["/regex-url-tools", "正则表达式与 URL 工具"],
  ["/svg-tools", "SVG 编辑、压缩与 PNG 导出"],
  ["/avatar-emoji-generator", "头像与团队表情生成器"],
  ["/random-picker", "随机抽取与公平分组"],
  ["/timer-tools", "倒计时、番茄钟与秒表"],
  ["/screen-recorder", "屏幕、窗口与标签页录制"],
]) {
  test(`server-renders ${pathname}`, async () => {
    const response = await render(pathname)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, new RegExp(marker))
    assert.ok(html.includes(`href="/blog${pathname}"`), `${pathname} should link to its matching guide`)
    assert.match(html, /查看完整使用教程/)
    assert.doesNotMatch(html, /侧栏广告位|Sidebar ad/)
  })
}

test("batch image processing exposes one mode-free removal flow", async () => {
  const response = await render("/remove-background")
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /批量图片处理/)
  assert.match(html, /随后可直接继续修图/)
  assert.match(html, /自动识别主要主体/)
  assert.match(html, /4\.6 MB/)
  assert.doesNotMatch(html, /人物与物体一键去背景|人像背景移除|通用物体去背景|BEN2|RMBG-2\.0/)
})
