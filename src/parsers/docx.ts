import type { FileAnalysis, MetaField } from '../types.js'
import { parseAigcJson, buildAigcResult } from './aigc.js'

export async function parseDocx(file: File): Promise<FileAnalysis> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const buffer = await file.arrayBuffer()
  const zip = unzipSync(new Uint8Array(buffer))

  function readXml(path: string): Document | null {
    const data = zip[path]
    if (!data) return null
    return new DOMParser().parseFromString(strFromU8(data), 'application/xml')
  }

  const core = readXml('docProps/core.xml')
  const custom = readXml('docProps/custom.xml')

  function getText(doc: Document | null, ...tags: string[]): string {
    if (!doc) return ''
    for (const tag of tags) {
      const el = doc.querySelector(tag) ?? doc.getElementsByTagName(tag)[0]
      if (el?.textContent?.trim()) return el.textContent.trim()
    }
    return ''
  }

  const CORE_FIELDS: [string, string][] = [
    ['title', '标题'],
    ['subject', '主题'],
    ['creator', '作者'],
    ['keywords', '关键词'],
    ['description', '描述'],
    ['lastModifiedBy', '最后修改者'],
    ['created', '创建时间'],
    ['modified', '修改时间'],
    ['category', '分类'],
  ]

  const coreFields: MetaField[] = CORE_FIELDS.map(([k, cn]) => {
    const v = getText(core, k, `cp:${k}`, `dc:${k}`, `dcterms:${k}`)
    return { key: k, value: v || '—', cnName: cn, isNonDefault: !!v }
  })

  let aigcRaw: string | null = null
  const customFields: MetaField[] = []

  custom?.querySelectorAll('property').forEach(prop => {
    const name = prop.getAttribute('name') ?? ''
    const valueEl = prop.querySelector('vt\\:lpwstr') ?? prop.getElementsByTagNameNS('*', 'lpwstr')[0]
    const value = valueEl?.textContent?.trim() ?? ''
    if (name === 'AIGC') aigcRaw = value
    customFields.push({
      key: name,
      value: value || '—',
      cnName: name === 'AIGC' ? 'AIGC 标识数据' : name,
      isNonDefault: name === 'AIGC' && !!value,
    })
  })

  const aigcFields = aigcRaw ? parseAigcJson(aigcRaw as string) : null
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'Office 自定义属性 AIGC' : '')

  const groups = [
    { id: 'core', title: '文档核心属性', fields: coreFields, nonDefaultCount: coreFields.filter(f => f.isNonDefault).length },
  ]
  if (customFields.length) {
    groups.push({ id: 'custom', title: '自定义属性', fields: customFields, nonDefaultCount: customFields.filter(f => f.isNonDefault).length })
  }

  return { file, mediaType: 'docx', aigc, groups }
}
