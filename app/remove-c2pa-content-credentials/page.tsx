import type { Metadata } from "next"
import { FileX2 } from "lucide-react"

import { MetadataCleanerTool } from "@/components/metadata-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费清理 C2PA Content Credentials", description: "本地检查、备份并清理 JPEG、PNG、WebP 中的 C2PA/JUMBF Content Credentials 容器。" }

export default function Page() { return <ToolShell title={{ zh: "清理 C2PA Content Credentials", en: "Remove C2PA Content Credentials" }} description={{ zh: "先检查来源凭证，再在浏览器中删除 C2PA/JUMBF 容器并验证像素载荷未改变。清理来源凭证不会改变图片的真实创作历史。", en: "Inspect provenance credentials, remove C2PA/JUMBF containers in the browser, and verify that the pixel payload is unchanged. Removing credentials does not change the image's real history." }} eyebrow="C2PA Cleaner" icon={FileX2} aside={<ToolAside notes={[{ zh: "清理前建议下载原文件备份", en: "Download a source-file backup before cleaning" }, { zh: "不会删除像素级不可见水印", en: "Does not remove pixel-level invisible watermarks" }, { zh: "不能据此宣称图片由真人创作", en: "Cannot be used to claim human authorship" }]} />}><MetadataCleanerTool mode="c2pa" /></ToolShell> }
