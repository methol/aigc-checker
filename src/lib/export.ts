import type { FileAnalysis } from '../types.js'

export function exportJson(analysis: FileAnalysis): void {
  const data = {
    file: analysis.file.name,
    size: analysis.file.size,
    type: analysis.file.type,
    mediaType: analysis.mediaType,
    aigc: analysis.aigc,
    metadata: Object.fromEntries(
      analysis.groups.map(g => [
        g.id,
        Object.fromEntries(
          g.fields.map(f => [
            f.key,
            { value: f.value, cnName: f.cnName, isNonDefault: f.isNonDefault },
          ])
        ),
      ])
    ),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aigc-checker-${analysis.file.name}.json`
  a.click()
  URL.revokeObjectURL(url)
}
