import type { AigcFields, AigcResult } from '../types.js'
import { lookupProducer } from '../dict/producer-codes.js'
import { parseProducerCode } from '../dict/aigc-cn.js'

export function parseXmpKvBase64(b64: string): AigcFields | null {
  try {
    const json = atob(b64)
    const obj = JSON.parse(json) as Record<string, unknown>
    const aigc = obj['AIGC'] as AigcFields | undefined
    if (!aigc || typeof aigc !== 'object') return null
    return aigc
  } catch {
    return null
  }
}

export function parseAigcJson(raw: string): AigcFields | null {
  try {
    const cleaned = raw.startsWith('AIGC=') ? raw.slice(5) : raw
    const obj = JSON.parse(cleaned) as Record<string, unknown>
    // Support both { AIGC: { ... } } and { Label: ..., ContentProducer: ... }
    const aigc = ('AIGC' in obj ? (obj['AIGC'] as AigcFields) : obj) as AigcFields
    if (!aigc.Label && !aigc.ContentProducer) return null
    return aigc
  } catch {
    return null
  }
}

export function parseProducerDisplay(code: string): {
  entityType: string
  creditCode: string
  serviceCode: string
  knownName?: string
} {
  const parsed = parseProducerCode(code)
  return {
    entityType: parsed.entityType,
    creditCode: parsed.creditCode,
    serviceCode: parsed.serviceCode,
    knownName: lookupProducer(parsed.creditCode),
  }
}

export function extractFromXmpString(xmpStr: string): AigcFields | null {
  if (!xmpStr) return null

  // 1. XmpKvBase64 attribute
  const b64Match = xmpStr.match(/XmpKvBase64="([^"]+)"/)
  if (b64Match?.[1]) {
    const fields = parseXmpKvBase64(b64Match[1])
    if (fields) return fields
  }

  // 2. AIGC namespace direct nodes
  const labelMatch = xmpStr.match(/AIGC:Label[>="' ]+([123])/)
  if (labelMatch?.[1]) {
    const fields: AigcFields = { Label: labelMatch[1] }
    const producerMatch = xmpStr.match(/AIGC:ContentProducer[>="' ]+([^<"'\s]+)/)
    if (producerMatch?.[1]) fields.ContentProducer = producerMatch[1].trim()
    const produceIdMatch = xmpStr.match(/AIGC:ProduceID[>="' ]+([^<"'\s]+)/)
    if (produceIdMatch?.[1]) fields.ProduceID = produceIdMatch[1].trim()
    return fields
  }

  return null
}

export function buildAigcResult(fields: AigcFields | null, source: string): AigcResult {
  if (!fields) return { status: 'not-found', fields: {}, source: '' }
  const required: (keyof AigcFields)[] = ['Label', 'ContentProducer']
  const hasAll = required.every(k => !!fields[k])
  return {
    status: hasAll ? 'found' : 'partial',
    fields,
    source,
  }
}
