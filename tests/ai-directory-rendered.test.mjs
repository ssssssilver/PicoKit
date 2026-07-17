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

test("server-renders the curated AI tools directory", async () => {
  const response = await render("/ai-tools")
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i)

  const html = await response.text()
  assert.match(html, /按任务查找 AI 工具/)
  assert.match(html, /Find AI tools by task/)
  assert.match(html, /Descriptions are manually reviewed/)
  assert.match(html, /Find the right AI tool faster/)
  assert.match(html, /Order is not a ranking/)
  assert.match(html, /ChatGPT/)
  assert.match(html, /Luma Dream Machine/)
  assert.match(html, /ElevenLabs/)
  assert.match(html, /application\/ld\+json/)
  assert.match(html, /href="\/ai-tools"/)
})

test("sitemap includes the AI directory and both lightweight-tool batches", async () => {
  const response = await render("/sitemap.xml")
  assert.equal(response.status, 200)
  const sitemap = await response.text()
  for (const route of ["/ai-tools", "/password-uuid-generator", "/date-time-tools", "/unit-ratio-converter", "/color-tools", "/regex-url-tools", "/svg-tools", "/avatar-emoji-generator", "/random-picker", "/timer-tools", "/screen-recorder"]) {
    assert.match(sitemap, new RegExp(route.replaceAll("/", "\\/")))
  }
})
