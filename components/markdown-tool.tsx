"use client"

import { Copy, Download, FileCode2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { downloadText } from "@/lib/browser-files"

const initial = `# TabNative Markdown\n\nWrite **Markdown** here and preview it locally.\n\n- No uploads\n- Sanitized HTML\n- Export Markdown or HTML`

export function MarkdownTool() {
  const { pick } = useLanguage()
  const [markdown, setMarkdown] = useState(initial)
  const [html, setHtml] = useState("")

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      const [{ marked }, { default: DOMPurify }] = await Promise.all([import("marked"), import("dompurify")])
      const rendered = await marked.parse(markdown, { gfm: true, breaks: true })
      if (active) setHtml(DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } }))
    }, 120)
    return () => { active = false; window.clearTimeout(timer) }
  }, [markdown])

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("Markdown 编辑与预览", "Edit and preview Markdown")}</CardTitle></CardHeader><CardContent>
    <div className="grid overflow-hidden rounded-lg border border-white/10 lg:grid-cols-2"><div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Markdown</p><Textarea aria-label={pick("Markdown 输入", "Markdown input")} value={markdown} onChange={(event) => setMarkdown(event.target.value)} className="min-h-[520px] resize-y border-0 bg-transparent p-0 font-mono text-sm focus-visible:ring-0" /></div><div className="min-h-[560px] bg-white p-6 text-slate-900"><p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{pick("预览", "Preview")}</p><article className="prose prose-slate max-w-none [&_a]:text-cyan-700 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_h1]:text-3xl [&_h2]:mt-8 [&_h2]:text-2xl [&_li]:my-1 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100" dangerouslySetInnerHTML={{ __html: html }} /></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => navigator.clipboard.writeText(markdown)}><Copy />{pick("复制 Markdown", "Copy Markdown")}</Button><Button variant="outline" onClick={() => navigator.clipboard.writeText(html)}><Copy />{pick("复制 HTML", "Copy HTML")}</Button><Button variant="outline" onClick={() => downloadText(markdown, "tabnative.md", "text/markdown")}><Download />.md</Button><Button variant="outline" onClick={() => downloadText(`<!doctype html><meta charset="utf-8"><body>${html}</body>`, "tabnative.html", "text/html")}><FileCode2 />.html</Button></div>
  </CardContent></Card></div>
}
