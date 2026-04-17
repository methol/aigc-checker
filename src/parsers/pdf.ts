import type { FileAnalysis, MetaField } from '../types.js'
import { parseAigcJson, extractFromXmpString, buildAigcResult } from './aigc.js'

export async function parsePdf(file: File): Promise<FileAnalysis> {
  const pdfjsLib = await import('pdfjs-dist')
  // Use CDN worker to avoid bundling WASM inline
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const meta = await doc.getMetadata()

  const infoDict = (meta.info ?? {}) as Record<string, unknown>
  const xmpStr = (meta.metadata as { getRaw?: () => string } | null)?.getRaw?.() ?? ''

  // AIGC: first check info dict /AIGC key, then XMP
  const aigcRaw = typeof infoDict['AIGC'] === 'string' ? infoDict['AIGC'] : null
  const aigcFields = aigcRaw
    ? parseAigcJson(aigcRaw)
    : extractFromXmpString(xmpStr)
  const aigc = buildAigcResult(aigcFields, aigcFields ? (aigcRaw ? 'PDF 信息字典 /AIGC' : 'PDF XMP 流') : '')

  const CN_MAP: Record<string, string> = {
    Title: '标题', Author: '作者', Subject: '主题', Keywords: '关键词',
    Creator: '创建软件', Producer: '生成软件（PDF 库）',
    CreationDate: '创建时间', ModDate: '修改时间', Trapped: '陷印处理',
    IsAcroFormPresent: '含表单', IsXFAPresent: '含 XFA 表单', IsCollectionPresent: '含附件集合',
    PDFFormatVersion: 'PDF 版本',
  }

  const ALWAYS_HIGHLIGHT = new Set(['Author', 'Creator', 'Producer', 'Keywords', 'Subject'])

  const fields: MetaField[] = Object.entries(infoDict)
    .filter(([k]) => k !== 'AIGC')
    .map(([k, v]) => ({
      key: k,
      value: String(v ?? '—'),
      cnName: CN_MAP[k] ?? k,
      isNonDefault: ALWAYS_HIGHLIGHT.has(k) && !!v && v !== '',
    }))

  const groups = [
    { id: 'info', title: '文档信息', fields, nonDefaultCount: fields.filter(f => f.isNonDefault).length },
  ]

  if (xmpStr) {
    groups.push({
      id: 'xmp', title: 'XMP 元数据',
      fields: [{ key: 'raw', value: xmpStr.length > 800 ? xmpStr.slice(0, 800) + '…' : xmpStr, cnName: '原始 XMP', isNonDefault: false }],
      nonDefaultCount: 0,
    })
  }

  return { file, mediaType: 'pdf', aigc, groups }
}
