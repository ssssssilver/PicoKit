import { describe, expect, it } from "vitest"

import { encodeWav } from "@/components/audio-tool"
import { makeIco } from "@/components/favicon-tool"
import { csvToJson, jsonToCsv, queryJson } from "@/components/json-tool"
import { parsePages } from "@/components/pdf-tool"
import { resetQrCanvasDisplaySize } from "@/components/qr-tool"
import { lineDiff, runCodec, textStats, transformLines } from "@/components/text-workbench"

describe("PDF page selection", () => {
  it("parses ranges, removes duplicates, and respects the page count", () => {
    expect(parsePages("1-3, 3, 5, 99", 6)).toEqual([0, 1, 2, 4])
    expect(parsePages("bad", 10)).toEqual([])
  })
})

describe("text workbench core", () => {
  it("counts Unicode text and transforms lines", () => {
    expect(textStats("Hello 世界\n\nNext")).toMatchObject({ characters: 14, words: 3, lines: 3, paragraphs: 2 })
    expect(transformLines("b\na\nb\n", "dedupe")).toBe("b\na\n")
    expect(transformLines("b\na", "sort")).toBe("a\nb")
  })

  it("round-trips UTF-8 Base64 and marks changed lines", () => {
    const encoded = runCodec("你好 TabNative", "base64-encode")
    expect(runCodec(encoded, "base64-decode")).toBe("你好 TabNative")
    expect(lineDiff("one\ntwo", "one\nthree").map((row) => row.kind)).toEqual(["same", "remove", "add"])
  })
})

describe("JSON tools", () => {
  it("queries dotted and indexed paths", () => {
    expect(queryJson({ items: [{ name: "TabNative" }] }, "$.items[0].name")).toBe("TabNative")
  })

  it("escapes CSV cells", () => {
    expect(jsonToCsv([{ name: 'A, "B"', local: true }])).toContain('"A, ""B"""')
    expect(csvToJson('name,note\nTabNative,"local, private"')).toEqual([{ name: "TabNative", note: "local, private" }])
  })
})

describe("binary exporters", () => {
  it("builds WAV and ICO containers with valid signatures", async () => {
    const wav = encodeWav([new Float32Array([0, .5, -.5])], 8000)
    expect(new TextDecoder().decode((await wav.arrayBuffer()).slice(0, 4))).toBe("RIFF")
    const ico = makeIco([{ size: 16, bytes: new Uint8Array([1, 2, 3]) }])
    expect([...ico.slice(0, 6)]).toEqual([0, 0, 1, 0, 1, 0])
  })
})

describe("QR preview sizing", () => {
  it("removes the fixed display dimensions added by the QR renderer", () => {
    const inlineStyles = new Map([["width", "480px"], ["height", "480px"]])
    resetQrCanvasDisplaySize({
      style: {
        removeProperty(name) {
          const previous = inlineStyles.get(name) ?? ""
          inlineStyles.delete(name)
          return previous
        },
      },
    })

    expect([...inlineStyles]).toEqual([])
  })
})
