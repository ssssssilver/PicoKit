import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("color tool accessibility copy", () => {
  it("localizes color-picker accessible names instead of appending English fragments", () => {
    const source = readFileSync("components/color-tool.tsx", "utf8")
    expect(source).toContain('pickerLabel={pick("选择前景色", "Choose foreground color")}')
    expect(source).toContain('screenPickerLabel={pick("从屏幕拾取背景色", "Pick background color from screen")}')
    expect(source).not.toContain('`${label} picker`')
    expect(source).not.toContain('`${label} screen picker`')
  })
})
