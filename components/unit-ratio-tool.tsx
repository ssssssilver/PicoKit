"use client"

import { ArrowLeftRight, Copy, Ruler } from "lucide-react"
import { useMemo, useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type UnitDefinition = { label: string; toBase: (value: number) => number; fromBase: (value: number) => number }
type UnitCategory = "length" | "mass" | "temperature" | "area" | "data"

const factor = (value: number): Pick<UnitDefinition, "toBase" | "fromBase"> => ({ toBase: (input) => input * value, fromBase: (input) => input / value })
const categories: Record<UnitCategory, { zh: string; en: string; units: Record<string, UnitDefinition> }> = {
  length: { zh: "长度", en: "Length", units: { mm: { label: "mm", ...factor(0.001) }, cm: { label: "cm", ...factor(0.01) }, m: { label: "m", ...factor(1) }, km: { label: "km", ...factor(1000) }, in: { label: "in", ...factor(0.0254) }, ft: { label: "ft", ...factor(0.3048) }, yd: { label: "yd", ...factor(0.9144) }, mi: { label: "mi", ...factor(1609.344) } } },
  mass: { zh: "质量", en: "Mass", units: { mg: { label: "mg", ...factor(0.000001) }, g: { label: "g", ...factor(0.001) }, kg: { label: "kg", ...factor(1) }, t: { label: "t", ...factor(1000) }, oz: { label: "oz", ...factor(0.028349523125) }, lb: { label: "lb", ...factor(0.45359237) } } },
  temperature: { zh: "温度", en: "Temperature", units: { C: { label: "°C", toBase: (value) => value, fromBase: (value) => value }, F: { label: "°F", toBase: (value) => (value - 32) * 5 / 9, fromBase: (value) => value * 9 / 5 + 32 }, K: { label: "K", toBase: (value) => value - 273.15, fromBase: (value) => value + 273.15 } } },
  area: { zh: "面积", en: "Area", units: { "mm²": { label: "mm²", ...factor(0.000001) }, "cm²": { label: "cm²", ...factor(0.0001) }, "m²": { label: "m²", ...factor(1) }, "km²": { label: "km²", ...factor(1_000_000) }, ha: { label: "ha", ...factor(10_000) }, "ft²": { label: "ft²", ...factor(0.09290304) }, acre: { label: "acre", ...factor(4046.8564224) } } },
  data: { zh: "数据大小", en: "Data size", units: { B: { label: "B", ...factor(1) }, KB: { label: "KB", ...factor(1000) }, MB: { label: "MB", ...factor(1_000_000) }, GB: { label: "GB", ...factor(1_000_000_000) }, KiB: { label: "KiB", ...factor(1024) }, MiB: { label: "MiB", ...factor(1024 ** 2) }, GiB: { label: "GiB", ...factor(1024 ** 3) } } },
}

export function UnitRatioTool() {
  const { pick } = useLanguage()
  const [category, setCategory] = useState<UnitCategory>("length")
  const [fromUnit, setFromUnit] = useState("m")
  const [toUnit, setToUnit] = useState("ft")
  const [value, setValue] = useState("1")
  const [width, setWidth] = useState("1920")
  const [height, setHeight] = useState("1080")
  const [targetWidth, setTargetWidth] = useState("1280")

  const unitEntries = Object.entries(categories[category].units)
  const result = useMemo(() => convertUnit(Number(value), categories[category].units[fromUnit], categories[category].units[toUnit]), [category, fromUnit, toUnit, value])
  const ratio = useMemo(() => calculateRatio(Number(width), Number(height), Number(targetWidth)), [height, targetWidth, width])

  function changeCategory(next: UnitCategory) {
    const keys = Object.keys(categories[next].units)
    setCategory(next)
    setFromUnit(keys[0])
    setToUnit(keys[1] ?? keys[0])
  }

  function swap() {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>{pick("常用单位转换", "Common unit converter")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2">{(Object.keys(categories) as UnitCategory[]).map((key) => <Button key={key} size="sm" variant={category === key ? "default" : "outline"} onClick={() => changeCategory(key)}>{pick(categories[key].zh, categories[key].en)}</Button>)}</div>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_150px_auto_1fr_150px]">
        <label className="grid gap-2 text-sm"><span>{pick("数值", "Value")}</span><Input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <label className="grid gap-2 text-sm"><span>{pick("从", "From")}</span><select value={fromUnit} onChange={(event) => setFromUnit(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-transparent px-3">{unitEntries.map(([key, unit]) => <option key={key} value={key}>{unit.label}</option>)}</select></label>
        <Button variant="outline" size="icon" onClick={swap} aria-label={pick("交换单位", "Swap units")}><ArrowLeftRight /></Button>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.05] px-3 py-2"><p className="text-xs text-zinc-500">{pick("结果", "Result")}</p><p className="mt-1 break-all font-mono text-lg text-cyan-200">{Number.isFinite(result) ? formatNumber(result) : "—"}</p></div>
        <label className="grid gap-2 text-sm"><span>{pick("到", "To")}</span><select value={toUnit} onChange={(event) => setToUnit(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-transparent px-3">{unitEntries.map(([key, unit]) => <option key={key} value={key}>{unit.label}</option>)}</select></label>
      </div>
      <Button variant="outline" disabled={!Number.isFinite(result)} onClick={() => navigator.clipboard.writeText(String(result))}><Copy />{pick("复制结果", "Copy result")}</Button>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>{pick("图片宽高比与等比缩放", "Aspect ratio and proportional resize")}</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-2 text-sm"><span>{pick("原始宽度", "Original width")}</span><Input type="number" min="1" value={width} onChange={(event) => setWidth(event.target.value)} /></label><label className="grid gap-2 text-sm"><span>{pick("原始高度", "Original height")}</span><Input type="number" min="1" value={height} onChange={(event) => setHeight(event.target.value)} /></label><label className="grid gap-2 text-sm"><span>{pick("目标宽度", "Target width")}</span><Input type="number" min="1" value={targetWidth} onChange={(event) => setTargetWidth(event.target.value)} /></label></div>
      {ratio ? <div className="grid gap-3 sm:grid-cols-3"><Result label={pick("最简比例", "Simplified ratio")} value={`${ratio.ratioWidth}:${ratio.ratioHeight}`} /><Result label={pick("小数比例", "Decimal ratio")} value={formatNumber(ratio.decimal)} /><Result label={pick("目标尺寸", "Target dimensions")} value={`${ratio.targetWidth} × ${ratio.targetHeight}`} /></div> : <div className="rounded-lg border border-amber-300/20 p-4 text-sm text-amber-200"><Ruler className="mr-2 inline size-4" />{pick("请输入大于 0 的宽度和高度。", "Enter widths and heights greater than zero.")}</div>}
    </CardContent></Card>
  </div>
}

function Result({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/10 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 font-mono text-xl text-zinc-100">{value}</p></div> }
function formatNumber(value: number) { return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 12 }).format(value) }

export function convertUnit(value: number, from?: UnitDefinition, to?: UnitDefinition) {
  if (!Number.isFinite(value) || !from || !to) return Number.NaN
  return to.fromBase(from.toBase(value))
}

export function greatestCommonDivisor(left: number, right: number): number {
  const a = Math.abs(Math.round(left)); const b = Math.abs(Math.round(right))
  return b === 0 ? a : greatestCommonDivisor(b, a % b)
}

export function calculateRatio(width: number, height: number, targetWidth: number) {
  if (![width, height, targetWidth].every((value) => Number.isFinite(value) && value > 0)) return null
  const divisor = greatestCommonDivisor(width, height)
  return { ratioWidth: Math.round(width) / divisor, ratioHeight: Math.round(height) / divisor, decimal: width / height, targetWidth: Math.round(targetWidth), targetHeight: Math.round(targetWidth * height / width) }
}
