import { File as NodeFile } from "node:buffer"

import { describe, expect, it } from "vitest"

import { c2paAiSignals, inspectImage, summarizeC2paValidation } from "@/lib/image-inspector"

const transparentPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

describe("image provenance signal precision", () => {
  it("keeps C2PA validity and signer trust as separate states", () => {
    expect(summarizeC2paValidation({ validation_state: "Trusted" })).toMatchObject({
      validated: true,
      state: "trusted",
      trust: "trusted",
    })
    expect(summarizeC2paValidation({
      validation_state: "Valid",
      validation_results: {
        activeManifest: { success: [], informational: [], failure: [] },
      },
    })).toMatchObject({ validated: true, state: "valid", trust: "unknown" })
    expect(summarizeC2paValidation({
      validation_state: "Valid",
      validation_status: [{ code: "signingCredential.untrusted", success: false }],
    })).toMatchObject({ validated: false, state: "invalid", trust: "untrusted" })
  })

  it("does not promote a generic workflow word to deterministic AI evidence", async () => {
    const file = new NodeFile(
      [transparentPixel, Buffer.from(" ordinary editorial workflow ")],
      "workflow.png",
      { type: "image/png" },
    ) as unknown as File

    const inspection = await inspectImage(file)
    expect(inspection.signals.filter((signal) => signal.group === "ai")).toEqual([])
    expect(inspection.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(inspection.inspectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("still recognizes an explicit generator name", async () => {
    const file = new NodeFile(
      [transparentPixel, Buffer.from(" ComfyUI workflow ")],
      "comfyui.png",
      { type: "image/png" },
    ) as unknown as File

    const inspection = await inspectImage(file)
    expect(inspection.signals.some((signal) => signal.group === "ai" && /ComfyUI/i.test(signal.value))).toBe(true)
  })

  it("extracts GPT Image 2 and algorithmic-media assertions from a parsed C2PA manifest", () => {
    const signals = c2paAiSignals({
      active_manifest: {
        claim_generator: "OpenAI ChatGPT Images",
        assertions: [{ data: { digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" } }],
      },
    })
    expect(signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "c2pa-ai-openai-image", severity: "high" }),
      expect.objectContaining({ id: "c2pa-ai-digital-source-type", severity: "high" }),
    ]))
  })

  it("does not turn a generic C2PA manifest into AI provenance", () => {
    expect(c2paAiSignals({ active_manifest: { claim_generator: "Camera Vendor" } })).toEqual([])
  })
})
