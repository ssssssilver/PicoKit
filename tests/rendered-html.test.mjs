import assert from "node:assert/strict"
import test from "node:test"

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url)
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`)
  const { default: worker } = await import(workerUrl.href)
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  )
}

test("server-renders the LocalProof homepage and security headers", async () => {
  const response = await render()
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i)
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
  const html = await response.text()
  assert.match(html, /LocalProof/)
  assert.match(html, /AI 证据留在文件里/)
  assert.match(html, /application\/ld\+json/)
  assert.doesNotMatch(html, /Codex is working|Your site is taking shape|react-loading-skeleton/)
})

for (const [pathname, marker] of [
  ["/ai-text-detector", "AI 文本检测"],
  ["/ai-image-detector", "AI 图片来源"],
  ["/remove-c2pa-content-credentials", "C2PA"],
  ["/gemini-watermark-remover", "Gemini"],
  ["/image-compressor", "图片压缩"],
]) {
  test(`server-renders ${pathname}`, async () => {
    const response = await render(pathname)
    assert.equal(response.status, 200)
    assert.match(await response.text(), new RegExp(marker))
  })
}
