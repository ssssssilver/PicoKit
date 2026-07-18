import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("../components/image-wobble-tool.tsx", import.meta.url), "utf8")
const page = readFileSync(new URL("../app/image-wobble-maker/page.tsx", import.meta.url), "utf8")

describe("image wobble animator experience", () => {
  it("keeps the complete local editing and export workflow wired", () => {
    expect(source).toContain('sample.src = "/illustrations/hero-image-workspace.webp"')
    expect(source).toContain('import("gifenc")')
    expect(source).toContain("captureStream(30)")
    expect(source).toContain("new MediaRecorder")
    expect(source).toContain('pick("全部涂满", "Fill all")')
    expect(source).toContain('pick("预览晃动", "Preview wobble")')
    expect(source).toContain('pick("生成本地动画", "Create local animation")')
  })

  it("keeps browser capability detection hydration-safe", () => {
    expect(source).toContain('const [videoSupport, setVideoSupport] = useState({ webm: "", mp4: "" })')
    expect(source).toContain('if (typeof MediaRecorder !== "undefined")')
    expect(source).not.toContain("const videoSupport = useMemo")
  })

  it("exposes best-use guidance and local-processing boundaries", () => {
    expect(page).toContain("适合头像、贴纸、插画、头发和衣摆")
    expect(page).toContain("GIF 最长边限制为 640 px")
    expect(page).toContain("使用本机 Canvas 与媒体编码器")
  })
})
