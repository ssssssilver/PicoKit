import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const pdfToolSource = readFileSync(new URL("../components/pdf-tool.tsx", import.meta.url), "utf8")
const pdfPageSource = readFileSync(new URL("../app/pdf-tools/page.tsx", import.meta.url), "utf8")
const toolShellSource = readFileSync(new URL("../components/tool-shell.tsx", import.meta.url), "utf8")
const workspaceSource = readFileSync(new URL("../components/pdf-workspace.tsx", import.meta.url), "utf8")

describe("PDF toolbox experience", () => {
  it("exposes the three persistent modes as an accessible tab interface", () => {
    expect(pdfToolSource).toContain('role="tablist"')
    expect(pdfToolSource).toContain('role="tab"')
    expect(pdfToolSource).toContain("aria-selected={selected}")
    expect(pdfToolSource).toContain("aria-controls={`pdf-panel-${tab.id}`}")
    expect(pdfToolSource.match(/role="tabpanel"/g)).toHaveLength(3)
    expect(pdfToolSource).toContain('event.key === "ArrowRight"')
    expect(pdfToolSource).toContain('event.key === "ArrowLeft"')
  })

  it("shows PDF-specific local processing details and mode-specific limits", () => {
    expect(pdfToolSource).toContain("PDF 本地处理")
    expect(pdfToolSource).toContain("后台 Worker")
    expect(pdfToolSource).toContain("最多 60 张，合计 250 MB，单张最高 40 MP")
    expect(pdfToolSource).toContain("一次最多转换 200 页")
    expect(pdfToolSource).not.toContain("DeviceCapability")
    expect(pdfPageSource).not.toContain("ToolAside")
  })

  it("uses the compact PDF hero and keeps workspace actions visible", () => {
    expect(pdfPageSource).toContain("compactHero")
    expect(toolShellSource).toContain("compactHero ?")
    expect(workspaceSource).toContain('className="sticky top-20')
    expect(workspaceSource).toContain("选择页面后可批量处理")
    expect(workspaceSource).toContain('id="pdf-export-settings"')
  })
})
