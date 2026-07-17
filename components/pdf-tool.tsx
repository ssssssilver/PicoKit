"use client"

import { FileImage, Images, Layers3 } from "lucide-react"
import { useState } from "react"

import { useLanguage } from "@/components/language-provider"
import { ImagesToPdfStudio, PdfToImagesStudio } from "@/components/pdf-conversion-studios"
import { PdfWorkspace } from "@/components/pdf-workspace"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parsePdfPageSpec } from "@/lib/pdf-conversion"

type Mode = "workspace" | "images" | "export"

export function PdfTool() {
  const { pick } = useLanguage()
  const [mode, setMode] = useState<Mode>("workspace")

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>{pick("PDF 工具箱", "PDF toolbox")}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{pick("整理与合并 PDF 页面，或在图片与 PDF 之间进行可预览、可配置的本地转换。", "Organize and merge PDF pages, or run previewable, configurable local conversions between images and PDF.")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant={mode === "workspace" ? "default" : "outline"} onClick={() => setMode("workspace")}><Layers3 />{pick("页面工作台", "Page workspace")}</Button>
          <Button variant={mode === "images" ? "default" : "outline"} onClick={() => setMode("images")}><Images />{pick("图片转 PDF", "Images to PDF")}</Button>
          <Button variant={mode === "export" ? "default" : "outline"} onClick={() => setMode("export")}><FileImage />{pick("PDF 转图片", "PDF to images")}</Button>
        </div>
      </CardContent>
    </Card>
    <div className={mode === "workspace" ? "" : "hidden"}><PdfWorkspace /></div>
    <div className={mode === "images" ? "" : "hidden"}><ImagesToPdfStudio /></div>
    <div className={mode === "export" ? "" : "hidden"}><PdfToImagesStudio /></div>
  </div>
}

export const parsePages = parsePdfPageSpec
