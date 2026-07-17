import type { Metadata } from "next"
import { Ruler } from "lucide-react"

import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"
import { UnitRatioTool } from "@/components/unit-ratio-tool"

export const metadata: Metadata = { title: "单位转换与图片宽高比计算", description: "本地转换长度、质量、温度、面积和数据大小，并计算图片宽高比和等比尺寸。" }
export default function Page() { return <ToolShell title={{ zh: "单位转换与宽高比计算", en: "Unit Converter and Aspect-ratio Calculator" }} description={{ zh: "转换常用公制、英制、温度和数据大小单位，并按原图比例计算目标尺寸。", en: "Convert common metric, imperial, temperature, and data-size units, and calculate proportional image dimensions." }} eyebrow="Local Unit & Ratio Toolkit" icon={Ruler} aside={<ToolAside notes={[{ zh: "数据单位同时支持十进制与二进制", en: "Data units support decimal and binary scales" }, { zh: "结果最多显示 12 位有效数字", en: "Results show up to 12 significant digits" }, { zh: "比例计算会取最简整数比", en: "Ratios are reduced to whole numbers" }]} />}><UnitRatioTool /></ToolShell> }
