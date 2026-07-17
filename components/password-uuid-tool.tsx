"use client"

import { Copy, KeyRound, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const characterSets = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
}

const ambiguousCharacters = new Set("Il1O0o|`'\"")

export function PasswordUuidTool() {
  const { pick } = useLanguage()
  const [length, setLength] = useState(20)
  const [enabled, setEnabled] = useState({ lowercase: true, uppercase: true, numbers: true, symbols: true })
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true)
  const [password, setPassword] = useState("")
  const [uuidCount, setUuidCount] = useState(5)
  const [uuids, setUuids] = useState("")
  const [error, setError] = useState("")

  const pool = useMemo(() => Object.entries(enabled)
    .filter(([, active]) => active)
    .map(([key]) => characterSets[key as keyof typeof characterSets])
    .join("")
    .split("")
    .filter((character) => !avoidAmbiguous || !ambiguousCharacters.has(character))
    .join(""), [avoidAmbiguous, enabled])
  const entropy = pool.length > 1 ? Math.round(length * Math.log2(pool.length)) : 0

  function generatePassword() {
    if (!pool) {
      setError(pick("请至少选择一种字符类型。", "Select at least one character type."))
      return
    }
    setError("")
    const activePools = (Object.keys(characterSets) as Array<keyof typeof characterSets>)
      .filter((key) => enabled[key])
      .map((key) => characterSets[key].split("").filter((character) => !avoidAmbiguous || !ambiguousCharacters.has(character)).join(""))
    setPassword(generatePasswordFromSets(Math.max(8, Math.min(128, length)), activePools))
  }

  function generateUuids() {
    const count = Math.max(1, Math.min(50, uuidCount))
    setUuidCount(count)
    setUuids(Array.from({ length: count }, () => crypto.randomUUID()).join("\n"))
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("安全密码生成器", "Secure password generator")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <label className="grid gap-2 text-sm"><span>{pick("密码长度", "Password length")}: {length}</span><input aria-label={pick("密码长度", "Password length")} type="range" min="8" max="128" value={length} onChange={(event) => setLength(Number(event.target.value))} className="w-full accent-cyan-300" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(characterSets) as Array<keyof typeof characterSets>).map((key) => <label key={key} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm"><Checkbox checked={enabled[key]} onCheckedChange={(checked) => setEnabled((current) => ({ ...current, [key]: checked === true }))} /><span>{{ lowercase: pick("小写字母", "Lowercase"), uppercase: pick("大写字母", "Uppercase"), numbers: pick("数字", "Numbers"), symbols: pick("符号", "Symbols") }[key]}</span></label>)}
        <label className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm sm:col-span-2"><Checkbox checked={avoidAmbiguous} onCheckedChange={(checked) => setAvoidAmbiguous(checked === true)} /><span>{pick("排除容易混淆的字符（I、l、1、O、0 等）", "Exclude ambiguous characters such as I, l, 1, O, and 0")}</span></label>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/10 p-4"><p className="break-all font-mono text-lg text-cyan-200">{password || pick("点击生成密码", "Generate a password")}</p><p className="mt-2 text-xs text-zinc-500">{pick("估算熵", "Estimated entropy")}: {entropy} bits · {pick("仅供强度参考", "strength estimate only")}</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={generatePassword}><RefreshCw />{pick("生成密码", "Generate password")}</Button><Button variant="outline" disabled={!password} onClick={() => navigator.clipboard.writeText(password)}><Copy />{pick("复制", "Copy")}</Button></div>
      {error ? <Alert variant="destructive"><KeyRound /><AlertTitle>{pick("无法生成", "Unable to generate")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>{pick("UUID v4 批量生成", "Bulk UUID v4 generator")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="grid max-w-xs gap-2 text-sm"><span>{pick("生成数量（1–50）", "Quantity (1–50)")}</span><Input type="number" min="1" max="50" value={uuidCount} onChange={(event) => setUuidCount(Number(event.target.value))} /></label>
      <div className="flex flex-wrap gap-2"><Button onClick={generateUuids}><RefreshCw />{pick("生成 UUID", "Generate UUIDs")}</Button><Button variant="outline" disabled={!uuids} onClick={() => navigator.clipboard.writeText(uuids)}><Copy />{pick("复制全部", "Copy all")}</Button></div>
      {uuids ? <Textarea aria-label={pick("UUID 结果", "UUID results")} value={uuids} readOnly className="min-h-44 font-mono text-xs" /> : null}
    </CardContent></Card>
  </div>
}

export function secureRandomString(length: number, pool: string) {
  if (!pool.length) throw new Error("Character pool is empty")
  if (pool.length > 256) throw new Error("Character pool exceeds 256 characters")
  const result: string[] = []
  const maximum = Math.floor(256 / pool.length) * pool.length
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.max(16, length - result.length)))
    for (const value of bytes) {
      if (value >= maximum) continue
      result.push(pool[value % pool.length])
      if (result.length === length) break
    }
  }
  return result.join("")
}

export function generatePasswordFromSets(length: number, pools: string[]) {
  const validPools = pools.filter(Boolean)
  if (!validPools.length) throw new Error("Character pool is empty")
  const safeLength = Math.max(length, validPools.length)
  const required = validPools.map((pool) => secureRandomString(1, pool))
  const remaining = secureRandomString(safeLength - required.length, validPools.join(""))
  const characters = [...required, ...remaining]
  for (let index = characters.length - 1; index > 0; index--) {
    const range = index + 1; const limit = Math.floor(256 / range) * range; let value: number
    do { value = crypto.getRandomValues(new Uint8Array(1))[0] } while (value >= limit)
    const target = value % range; [characters[index], characters[target]] = [characters[target], characters[index]]
  }
  return characters.join("")
}
