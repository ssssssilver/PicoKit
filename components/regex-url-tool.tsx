"use client"

import { Copy, Link2, Play, Regex } from "lucide-react"
import { useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type RegexResult = { matches: Array<{ value: string; index: number; groups: string[] }>; replaced: string }

export function RegexUrlTool() {
  const { pick } = useLanguage()
  const [pattern, setPattern] = useState("\\b[A-Z][a-z]+\\b")
  const [flags, setFlags] = useState("g")
  const [testText, setTestText] = useState("TabNative keeps Alice and Bob's files in the browser.")
  const [replacement, setReplacement] = useState("[$&]")
  const [regexResult, setRegexResult] = useState<RegexResult | null>(null)
  const [regexError, setRegexError] = useState("")
  const [running, setRunning] = useState(false)
  const [codecText, setCodecText] = useState("https://example.com/search?q=TabNative 工具")
  const [codecResult, setCodecResult] = useState("")
  const [urlInput, setUrlInput] = useState("https://example.com/path?utm_source=tabnative&lang=zh#section")
  const urlDetails = useMemo(() => parseUrlDetails(urlInput), [urlInput])

  async function testRegex() {
    setRegexError(""); setRunning(true); setRegexResult(null)
    try { setRegexResult(await runRegexWorker(pattern, flags, testText, replacement)) }
    catch (reason) { setRegexError(reason instanceof Error ? reason.message : pick("正则表达式无法运行。", "The regular expression could not run.")) }
    finally { setRunning(false) }
  }

  function runCodec(action: "encode-uri" | "decode-uri" | "encode-component" | "decode-component") {
    try {
      const next = action === "encode-uri" ? encodeURI(codecText) : action === "decode-uri" ? decodeURI(codecText) : action === "encode-component" ? encodeURIComponent(codecText) : decodeURIComponent(codecText)
      setCodecResult(next); setRegexError("")
    } catch { setCodecResult(""); setRegexError(pick("输入包含无效的 URL 转义序列。", "The input contains an invalid URL escape sequence.")) }
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("正则表达式测试与替换", "Regex tester and replacer")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]"><label className="grid gap-2 text-sm"><span>{pick("表达式", "Pattern")}</span><Input value={pattern} maxLength={500} onChange={(event) => setPattern(event.target.value)} className="font-mono" /></label><label className="grid gap-2 text-sm"><span>{pick("标志", "Flags")}</span><Input value={flags} maxLength={6} onChange={(event) => setFlags(event.target.value)} className="font-mono" placeholder="gimu" /></label></div>
      <label className="grid gap-2 text-sm"><span>{pick("测试文本", "Test text")}</span><Textarea value={testText} maxLength={100_000} onChange={(event) => setTestText(event.target.value)} className="min-h-44 font-mono text-xs" /></label>
      <label className="grid gap-2 text-sm"><span>{pick("替换内容", "Replacement")}</span><Input value={replacement} onChange={(event) => setReplacement(event.target.value)} className="font-mono" /></label>
      <Button onClick={testRegex} disabled={running}><Play />{running ? pick("测试中…", "Testing…") : pick("测试并替换", "Test and replace")}</Button>
      {regexError ? <Alert variant="destructive"><Regex /><AlertTitle>{pick("无法处理", "Unable to process")}</AlertTitle><AlertDescription>{regexError}</AlertDescription></Alert> : null}
      {regexResult ? <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border border-white/10 p-4"><p className="text-sm font-semibold">{pick("匹配结果", "Matches")} · {regexResult.matches.length}{regexResult.matches.length >= 200 ? "+" : ""}</p><div className="mt-3 max-h-64 space-y-2 overflow-auto">{regexResult.matches.length ? regexResult.matches.map((match, index) => <div key={`${match.index}-${index}`} className="rounded border border-white/10 px-3 py-2 font-mono text-xs"><span className="text-cyan-300">@{match.index}</span> {match.value || "(empty)"}{match.groups.length ? <span className="text-zinc-500"> · {match.groups.join(" | ")}</span> : null}</div>) : <p className="text-sm text-zinc-500">{pick("没有匹配项", "No matches")}</p>}</div></div><div className="rounded-lg border border-white/10 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{pick("替换结果", "Replacement result")}</p><button type="button" onClick={() => navigator.clipboard.writeText(regexResult.replaced)} className="text-zinc-500 hover:text-cyan-300" aria-label={pick("复制替换结果", "Copy replacement result")}><Copy className="size-4" /></button></div><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-300">{regexResult.replaced}</pre></div></div> : null}
      <p className="text-xs leading-5 text-zinc-500">{pick("表达式在独立 Worker 中执行；超过 500 毫秒会自动终止，避免页面被复杂表达式卡住。", "Patterns run in a separate Worker and are stopped after 500 ms so complex expressions cannot freeze the page.")}</p>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>{pick("URL 编解码", "URL encoder and decoder")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <Textarea value={codecText} onChange={(event) => setCodecText(event.target.value)} className="min-h-28 font-mono text-xs" />
      <div className="flex flex-wrap gap-2"><Button onClick={() => runCodec("encode-component")}>{pick("编码组件", "Encode component")}</Button><Button variant="outline" onClick={() => runCodec("decode-component")}>{pick("解码组件", "Decode component")}</Button><Button variant="outline" onClick={() => runCodec("encode-uri")}>encodeURI</Button><Button variant="outline" onClick={() => runCodec("decode-uri")}>decodeURI</Button></div>
      {codecResult ? <div className="rounded-lg border border-white/10 p-4"><div className="flex justify-between gap-3"><p className="break-all font-mono text-xs">{codecResult}</p><button type="button" onClick={() => navigator.clipboard.writeText(codecResult)} aria-label={pick("复制结果", "Copy result")}><Copy className="size-4" /></button></div></div> : null}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>{pick("URL 与查询参数解析", "URL and query-parameter parser")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <Input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} className="font-mono" />
      {!urlDetails ? <Alert variant="destructive"><Link2 /><AlertTitle>{pick("URL 无效", "Invalid URL")}</AlertTitle><AlertDescription>{pick("请输入包含协议和域名的完整 URL。", "Enter a complete URL including its scheme and host.")}</AlertDescription></Alert> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Detail label="Origin" value={urlDetails.origin} /><Detail label="Path" value={urlDetails.pathname} /><Detail label="Hash" value={urlDetails.hash || "—"} /><Detail label={pick("参数数量", "Parameters")} value={String(urlDetails.parameters.length)} /></div>{urlDetails.parameters.length ? <div className="overflow-hidden rounded-lg border border-white/10"><div className="grid grid-cols-[minmax(100px,.7fr)_1fr] bg-white/[.03] px-3 py-2 text-xs text-zinc-500"><span>Key</span><span>Value</span></div>{urlDetails.parameters.map(([key, value], index) => <div key={`${key}-${index}`} className="grid grid-cols-[minmax(100px,.7fr)_1fr] border-t border-white/10 px-3 py-2 font-mono text-xs"><span className="break-all text-cyan-300">{key}</span><span className="break-all">{value}</span></div>)}</div> : null}</div>}
    </CardContent></Card>
  </div>
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 break-all font-mono text-xs">{value}</p></div> }

export function parseUrlDetails(input: string) {
  try { const url = new URL(input); return { origin: url.origin, pathname: url.pathname, hash: url.hash, parameters: [...url.searchParams.entries()] as Array<[string, string]> } } catch { return null }
}

export function runRegexWorker(pattern: string, flags: string, text: string, replacement: string): Promise<RegexResult> {
  if (pattern.length > 500) return Promise.reject(new Error("Pattern exceeds 500 characters"))
  if (text.length > 100_000) return Promise.reject(new Error("Test text exceeds 100,000 characters"))
  const workerSource = `self.onmessage=({data})=>{try{const base=new RegExp(data.pattern,data.flags);const scanFlags=data.flags.includes('g')?data.flags:data.flags+'g';const scan=new RegExp(data.pattern,scanFlags);const matches=[];let match;while((match=scan.exec(data.text))&&matches.length<200){matches.push({value:match[0],index:match.index,groups:match.slice(1)});if(match[0]==='')scan.lastIndex++}self.postMessage({ok:true,result:{matches,replaced:data.text.replace(base,data.replacement)}})}catch(error){self.postMessage({ok:false,error:error.message})}}`
  const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }))
  const worker = new Worker(url)
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); reject(new Error("The pattern exceeded the 500 ms safety limit")) }, 500)
    worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: RegexResult; error?: string }>) => {
      window.clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url)
      if (event.data.ok && event.data.result) resolve(event.data.result)
      else reject(new Error(event.data.error || "Invalid regular expression"))
    }
    worker.onerror = () => { window.clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); reject(new Error("Regex Worker could not start")) }
    worker.postMessage({ pattern, flags, text, replacement })
  })
}
