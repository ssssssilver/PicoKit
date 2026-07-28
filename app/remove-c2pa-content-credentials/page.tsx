import type { Metadata } from "next"
import { FileX2 } from "lucide-react"

import { MetadataCleanerTool } from "@/components/metadata-cleaner-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费去除图片 C2PA 信息", description: "查看并删除 JPEG、PNG、WebP 图片中的 C2PA 内容凭证；不改变画面内容，文件不上传。" }

export default function Page() { return <ToolShell title={{ zh: "去除图片 C2PA 信息", en: "Remove C2PA Content Credentials" }} description={{ zh: "先查看图片中的 C2PA 内容凭证，再删除相关信息并确认画面没有变化。删除凭证不会改变图片真实的创作来源。", en: "Inspect provenance credentials, remove C2PA/JUMBF containers in the browser, and verify that the pixel payload is unchanged. Removing credentials does not change the image's real history." }} eyebrow="C2PA Cleaner" icon={FileX2} aside={<ToolAside notes={[{ zh: "处理前建议保留原文件", en: "Download a source-file backup before cleaning" }, { zh: "不会删除画面中的不可见水印", en: "Does not remove pixel-level invisible watermarks" }, { zh: "不能据此宣称图片由真人创作", en: "Cannot be used to claim human authorship" }]} />}><MetadataCleanerTool mode="c2pa" /></ToolShell> }
