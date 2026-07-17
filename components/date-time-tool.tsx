"use client"

import { CalendarClock, Copy, RefreshCw } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { localeForLanguage } from "@/lib/i18n"

const timeZones = ["UTC", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"]

export function DateTimeTool() {
  const { pick, language } = useLanguage()
  const [timeInput, setTimeInput] = useState("")
  const [zone, setZone] = useState("Asia/Hong_Kong")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [asOfDate, setAsOfDate] = useState("")

  const parsedTime = useMemo(() => parseDateTimeInput(timeInput), [timeInput])
  const interval = useMemo(() => calculateDateInterval(startDate, endDate), [endDate, startDate])
  const age = useMemo(() => calculateAge(birthDate, asOfDate), [asOfDate, birthDate])

  function useCurrentTime() {
    setTimeInput(String(Date.now()))
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("时间戳、ISO 时间与时区转换", "Timestamp, ISO, and time-zone converter")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input aria-label={pick("时间输入", "Time input")} value={timeInput} onChange={(event) => setTimeInput(event.target.value)} placeholder={pick("输入秒、毫秒时间戳或 ISO 时间", "Enter seconds, milliseconds, or an ISO date")} /><Button variant="outline" onClick={useCurrentTime}><RefreshCw />{pick("使用当前时间", "Use current time")}</Button></div>
      <label className="grid max-w-sm gap-2 text-sm"><span>{pick("显示时区", "Display time zone")}</span><select value={zone} onChange={(event) => setZone(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-transparent px-3">{timeZones.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      {timeInput && !parsedTime ? <Alert variant="destructive"><CalendarClock /><AlertTitle>{pick("无法识别时间", "Time not recognized")}</AlertTitle><AlertDescription>{pick("请输入有效的秒/毫秒时间戳或 ISO 8601 时间。", "Enter a valid seconds/milliseconds timestamp or ISO 8601 date.")}</AlertDescription></Alert> : null}
      {parsedTime ? <div className="grid gap-3 sm:grid-cols-2">
        <Result label={pick("Unix 秒", "Unix seconds")} value={String(Math.floor(parsedTime.getTime() / 1000))} />
        <Result label={pick("Unix 毫秒", "Unix milliseconds")} value={String(parsedTime.getTime())} />
        <Result label="ISO 8601" value={parsedTime.toISOString()} wide />
        <Result label={pick("所选时区", "Selected time zone")} value={new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: "full", timeStyle: "long", timeZone: zone }).format(parsedTime)} wide />
      </div> : null}
    </CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{pick("日期间隔", "Date duration")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm"><span>{pick("开始日期", "Start date")}</span><DateInput value={startDate} onValueChange={setStartDate} /></label><label className="grid gap-2 text-sm"><span>{pick("结束日期", "End date")}</span><DateInput value={endDate} onValueChange={setEndDate} /></label></div>
        {interval ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.05] p-4"><p className="text-3xl font-semibold text-cyan-200">{interval.days} {pick("天", "days")}</p><p className="mt-2 text-sm text-zinc-500">{interval.weeks} {pick("周", "weeks")} + {interval.remainingDays} {pick("天", "days")} · {interval.hours.toLocaleString()} {pick("小时", "hours")}</p></div> : <p className="text-sm text-zinc-500">{pick("选择两个日期后显示自然日间隔。", "Choose two dates to calculate the calendar-day duration.")}</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>{pick("精确年龄", "Exact age")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm"><span>{pick("出生日期", "Birth date")}</span><DateInput value={birthDate} onValueChange={setBirthDate} /></label><label className="grid gap-2 text-sm"><span>{pick("计算到", "Age on")}</span><DateInput value={asOfDate} onValueChange={setAsOfDate} /></label></div>
        {age ? <div className="rounded-lg border border-white/10 p-4"><p className="text-2xl font-semibold">{age.years} {pick("岁", "years")}, {age.months} {pick("个月", "months")}, {age.days} {pick("天", "days")}</p><p className="mt-2 text-sm text-zinc-500">{pick("总计", "Total")}: {age.totalDays.toLocaleString()} {pick("天", "days")}</p></div> : <p className="text-sm text-zinc-500">{pick("选择出生日期和计算日期；计算日期必须不早于出生日期。", "Choose a birth date and an age-on date; the latter must not be earlier.")}</p>}
      </CardContent></Card>
    </div>
  </div>
}

function DateInput({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  function update(event: FormEvent<HTMLInputElement>) {
    onValueChange(event.currentTarget.value)
  }

  return <input type="date" value={value} onInput={update} onChange={update} className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30" />
}

function Result({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  const { format } = useLanguage()
  return <div className={`rounded-lg border border-white/10 p-4 ${wide ? "sm:col-span-2" : ""}`}><p className="text-xs text-zinc-500">{label}</p><div className="mt-2 flex items-start justify-between gap-3"><p className="min-w-0 break-all font-mono text-sm text-zinc-200">{value}</p><button type="button" onClick={() => navigator.clipboard.writeText(value)} className="shrink-0 text-zinc-500 hover:text-cyan-300" aria-label={format("复制 {label}", "Copy {label}", { label })}><Copy className="size-4" /></button></div></div>
}

export function parseDateTimeInput(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  const date = Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)
    ? new Date(Math.abs(numeric) < 100_000_000_000 ? numeric * 1000 : numeric)
    : new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function calculateDateInterval(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`)
  const endTime = Date.parse(`${end}T00:00:00Z`)
  if (!start || !end || !Number.isFinite(startTime) || !Number.isFinite(endTime)) return null
  const days = Math.abs(Math.round((endTime - startTime) / 86_400_000))
  return { days, weeks: Math.floor(days / 7), remainingDays: days % 7, hours: days * 24 }
}

export function calculateAge(birth: string, asOf: string) {
  if (!birth || !asOf) return null
  const birthDate = new Date(`${birth}T00:00:00Z`)
  const endDate = new Date(`${asOf}T00:00:00Z`)
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < birthDate) return null
  let years = endDate.getUTCFullYear() - birthDate.getUTCFullYear()
  let months = endDate.getUTCMonth() - birthDate.getUTCMonth()
  let days = endDate.getUTCDate() - birthDate.getUTCDate()
  if (days < 0) {
    months--
    days += new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 0)).getUTCDate()
  }
  if (months < 0) { years--; months += 12 }
  return { years, months, days, totalDays: Math.floor((endDate.getTime() - birthDate.getTime()) / 86_400_000) }
}
