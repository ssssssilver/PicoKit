export type Classification = { label: string; score: number }
export type PipelineOutput = Classification[] | Classification[][]

export function splitText(text: string, maxChunks = 24) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ""

  for (const paragraph of paragraphs) {
    const combined = current ? `${current}\n\n${paragraph}` : paragraph
    if (combined.length <= 1800) current = combined
    else {
      if (current) chunks.push(current)
      if (paragraph.length <= 1800) current = paragraph
      else {
        for (let offset = 0; offset < paragraph.length; offset += 1550) {
          chunks.push(paragraph.slice(offset, offset + 1800))
        }
        current = ""
      }
    }
  }

  if (current) chunks.push(current)
  return chunks.slice(0, maxChunks)
}

export function normalizeOutput(output: PipelineOutput, count: number) {
  if (count === 1 && output.length && !Array.isArray(output[0])) {
    return [output as Classification[]]
  }
  return output as Classification[][]
}

export function aiScore(items: Classification[]) {
  const ai = items.find((item) => /(^ai$|fake|generated)/i.test(item.label))
  if (ai) return ai.score
  const human = items.find((item) => /human|real/i.test(item.label))
  return human ? 1 - human.score : items[0]?.score ?? 0.5
}
