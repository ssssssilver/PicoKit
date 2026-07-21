import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const editorSource = readFileSync(new URL("../components/quick-image-editor.tsx", import.meta.url), "utf8")

describe("quick-edit handoff loading regression", () => {
  it("announces restoration while a queue from the previous workflow step is loading", () => {
    expect(editorSource).toContain("const [restoringHandoff, setRestoringHandoff] = useState(false)")
    expect(editorSource).toContain("queueMicrotask(() => {")
    expect(editorSource).toContain("setRestoringHandoff(true)")
    expect(editorSource).toMatch(/\.finally\(\(\) => \{\s+setRestoringHandoff\(false\)/)
    expect(editorSource).not.toContain("if (cancelled) return\n      setRestoringHandoff(true)")
    expect(editorSource).toContain("正在恢复上一步的图片队列")
    expect(editorSource).toContain("Loading the local image from the previous tool and validating its contents")
    expect(editorSource).toMatch(/restoringHandoff[\s\S]*?role="status"[\s\S]*?aria-live="polite"/)
    expect(editorSource).toContain('getElementById("quick-edit-queue")?.scrollIntoView({ block: "start" })')
    expect(editorSource).toContain('id="quick-edit-queue"')
  })
})
