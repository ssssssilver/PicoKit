"use client"

import { Copy, Shuffle, Users } from "lucide-react"
import { useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type PickerMode = "one" | "many" | "groups"

export function RandomPickerTool() {
  const { pick } = useLanguage()
  const [text, setText] = useState("Alice\nBob\nCharlie\nDiana\nEvan\nFatima")
  const [mode, setMode] = useState<PickerMode>("one")
  const [count, setCount] = useState(2)
  const [dedupe, setDedupe] = useState(true)
  const [result, setResult] = useState<string[][]>([])
  const [history, setHistory] = useState<string[]>([])
  const entries = useMemo(() => parsePickerEntries(text, dedupe), [dedupe, text])

  function changeMode(nextMode: PickerMode) {
    setMode(nextMode)
    setResult([])
  }

  function pickNow() {
    if (!entries.length) return
    const shuffled = shuffleWithCrypto(entries)
    let next: string[][]
    if (mode === "one") next = [[shuffled[0]]]
    else if (mode === "many") next = [shuffled.slice(0, Math.max(1, Math.min(count, entries.length)))]
    else {
      const groupCount = Math.max(2, Math.min(count, entries.length)); next = Array.from({ length: groupCount }, () => [])
      shuffled.forEach((entry, index) => next[index % groupCount].push(entry))
    }
    setResult(next)
    const summary = next.map((group, index) => mode === "groups" ? `${pick("第", "Group ")}${index + 1}${pick("组", "")}: ${group.join(", ")}` : group.join(", ")).join(" · ")
    setHistory((current) => [summary, ...current].slice(0, 8))
  }

  const copyText = result.map((group, index) => mode === "groups" ? `${pick("第", "Group ")}${index + 1}${pick("组", "")}: ${group.join(", ")}` : group.join("\n")).join("\n")
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <Card><CardHeader><CardTitle>{pick("随机抽取与公平分组", "Random selection and fair grouping")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <label className="grid gap-2 text-sm"><span>{pick("候选项，每行一个", "Candidates, one per line")}</span><Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-72" placeholder={pick("每行输入一个名称或选项", "Enter one name or option per line")} /></label>
      <div className="flex flex-wrap gap-2">{(["one", "many", "groups"] as PickerMode[]).map((item) => <Button key={item} variant={mode === item ? "default" : "outline"} onClick={() => changeMode(item)}>{{ one: pick("抽取 1 项", "Pick one"), many: pick("抽取多项", "Pick several"), groups: pick("随机分组", "Create groups") }[item]}</Button>)}</div>
      {mode !== "one" ? <label className="grid max-w-xs gap-2 text-sm"><span>{mode === "groups" ? pick("分组数量", "Number of groups") : pick("抽取数量", "Number to pick")}</span><Input type="number" min={mode === "groups" ? 2 : 1} max={Math.max(2, entries.length)} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label> : null}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={dedupe} onCheckedChange={(checked) => setDedupe(checked === true)} />{pick("忽略重复项", "Ignore duplicate entries")}</label>
      <div className="flex flex-wrap items-center gap-3"><Button onClick={pickNow} disabled={!entries.length}><Shuffle />{pick("开始随机选择", "Make random selection")}</Button><span className="text-xs text-zinc-500">{entries.length} {pick("个有效候选项", "valid candidates")}</span></div>
      {!entries.length ? <Alert variant="destructive"><Users /><AlertTitle>{pick("没有候选项", "No candidates")}</AlertTitle><AlertDescription>{pick("请至少输入一个非空选项。", "Enter at least one non-empty option.")}</AlertDescription></Alert> : null}
    </CardContent></Card>
    <div className="space-y-6"><Card><CardHeader><CardTitle>{pick("本次结果", "Current result")}</CardTitle></CardHeader><CardContent className="space-y-4">{result.length ? <>{result.map((group, index) => <div key={index} className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.05] p-4"><p className="text-xs text-zinc-500">{mode === "groups" ? `${pick("第", "Group ")}${index + 1}${pick("组", "")}` : pick("已选中", "Selected")}</p><div className="mt-2 space-y-1 text-lg font-semibold">{group.map((entry) => <p key={entry}>{entry}</p>)}</div></div>)}<Button variant="outline" onClick={() => navigator.clipboard.writeText(copyText)}><Copy />{pick("复制结果", "Copy result")}</Button></> : <p className="text-sm text-zinc-500">{pick("结果会显示在这里。", "Results will appear here.")}</p>}</CardContent></Card>
      {history.length ? <Card><CardHeader><CardTitle>{pick("本次页面记录", "This-page history")}</CardTitle></CardHeader><CardContent><ol className="space-y-2 text-xs text-zinc-500">{history.map((item, index) => <li key={`${item}-${index}`} className="rounded border border-white/10 p-2">{item}</li>)}</ol></CardContent></Card> : null}</div>
  </div>
}

export function parsePickerEntries(text: string, dedupe: boolean) { const entries = text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); return dedupe ? [...new Set(entries)] : entries }
export function shuffleWithCrypto<T>(input: readonly T[]) {
  const output = [...input]
  for (let index = output.length - 1; index > 0; index--) {
    const range = index + 1; const limit = Math.floor(0x1_0000_0000 / range) * range; let value: number
    do { value = crypto.getRandomValues(new Uint32Array(1))[0] } while (value >= limit)
    const target = value % range; [output[index], output[target]] = [output[target], output[index]]
  }
  return output
}
