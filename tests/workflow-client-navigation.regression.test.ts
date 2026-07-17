import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const backgroundSource = readFileSync(new URL("../components/background-removal-batch-studio.tsx", import.meta.url), "utf8")
const editorSource = readFileSync(new URL("../components/quick-image-editor.tsx", import.meta.url), "utf8")

describe("local image workflow navigation regression", () => {
  it("uses client navigation so in-memory queues survive movement between workflow steps", () => {
    expect(backgroundSource).toContain("useRouter")
    expect(backgroundSource).toContain('router.push(`/image-editor?batch=')
    expect(backgroundSource).not.toContain("window.location.assign")

    expect(editorSource).toContain("useRouter")
    expect(editorSource).toContain('router.push(`/image-compressor?batch=')
    expect(editorSource).toContain('router.push(`/image-compressor?asset=')
    expect(editorSource).not.toContain("window.location.assign")
  })
})
