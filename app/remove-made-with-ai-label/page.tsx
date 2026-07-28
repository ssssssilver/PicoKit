import type { Metadata } from "next"
import { Tags } from "lucide-react"

import { MetadataCleanerTool } from "@/components/metadata-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "去除图片中的 Made with AI 信息", description: "清理图片中可能触发“Made with AI”标签的 IPTC、XMP、C2PA 等元数据；文件不上传。" }

export default function Page() { return <ToolShell title={{ zh: "去除 Made with AI 信息", en: "Remove Made with AI Label Signals" }} description={{ zh: "查看并删除可能触发“Made with AI”标签的图片元数据。不同平台还可能根据画面特征判断，因此不能保证标签一定消失。", en: "Inspect and selectively remove metadata triggers such as DigitalSourceType and C2PA AI assertions. Platforms may still use pixel classifiers, so label removal is not guaranteed." }} eyebrow="AI Label Signals" icon={Tags} aside={<ToolAside notes={[{ zh: "只处理图片中的相关元数据", en: "Only processes metadata triggers inside the file" }, { zh: "不会影响平台对画面内容的检测", en: "Platform pixel classifiers are unaffected" }, { zh: "不能保证通过所有平台检测", en: "Does not promise to bypass platform detection" }]} />}><MetadataCleanerTool mode="label" /></ToolShell> }
