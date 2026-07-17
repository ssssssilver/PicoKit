import assert from "node:assert/strict"
import test from "node:test"

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url)
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`)
  const { default: worker } = await import(workerUrl.href)
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  )
}

test("server-renders the tool guide blog", async () => {
  const response = await render("/blog")
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /每个工具，都有一篇清晰教程/)
  assert.match(html, /A clear guide for every tool/)
  assert.match(html, /32<!-- --> <!-- -->篇教程/)
  assert.match(html, /href="\/blog\/image-compressor"/)
  assert.match(html, /application\/ld\+json/)
})

test("server-renders a complete tool guide article", async () => {
  const response = await render("/blog/image-compressor")
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /如何使用批量图片优化与交付/)
  assert.match(html, /How to use Batch Image Optimizer/)
  assert.match(html, /开始前准备/)
  assert.match(html, /分步操作/)
  assert.match(html, /如何验证结果/)
  assert.match(html, /常见问题与排错/)
  assert.match(html, /href="\/image-compressor"/)
  assert.match(html, /"@type":"HowTo"/)
})

test("unknown guide slugs return 404", async () => {
  const response = await render("/blog/not-a-tool")
  assert.equal(response.status, 404)
})

test("sitemap includes the blog index and tool guide routes", async () => {
  const response = await render("/sitemap.xml")
  const xml = await response.text()

  assert.equal(response.status, 200)
  assert.match(xml, /\/blog<\/loc>/)
  assert.match(xml, /\/blog\/ai-text-detector<\/loc>/)
  assert.match(xml, /\/blog\/image-compressor<\/loc>/)
  assert.match(xml, /\/blog\/screen-recorder<\/loc>/)
})
