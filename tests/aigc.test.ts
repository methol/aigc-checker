import { describe, it, expect } from 'vitest'
import {
  parseXmpKvBase64,
  parseAigcJson,
  parseProducerDisplay,
  extractFromXmpString,
  buildAigcResult,
} from '../src/parsers/aigc.js'

const SAMPLE_FIELDS = {
  Label: '1',
  ContentProducer: '001191110000802100433BY43',
  ProduceID: 'TEST-001',
  ReservedCode1: 'd41d8cd98f00b204e9800998ecf8427e',
}
const SAMPLE_JSON = JSON.stringify({ AIGC: SAMPLE_FIELDS })

describe('parseXmpKvBase64', () => {
  it('decodes valid base64 JSON', () => {
    const b64 = btoa(SAMPLE_JSON)
    const result = parseXmpKvBase64(b64)
    expect(result?.Label).toBe('1')
    expect(result?.ContentProducer).toBe('001191110000802100433BY43')
  })
  it('returns null for invalid base64', () => {
    expect(parseXmpKvBase64('not-valid-base64!!!')).toBeNull()
  })
  it('returns null when AIGC key missing', () => {
    expect(parseXmpKvBase64(btoa('{"other":"data"}'))).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseXmpKvBase64('')).toBeNull()
  })
})

describe('parseAigcJson', () => {
  it('parses AIGC-wrapped JSON', () => {
    const result = parseAigcJson(SAMPLE_JSON)
    expect(result?.Label).toBe('1')
  })
  it('parses AIGC= prefix format', () => {
    const result = parseAigcJson('AIGC=' + SAMPLE_JSON)
    expect(result?.Label).toBe('1')
  })
  it('parses flat AIGC fields without wrapper', () => {
    const flat = JSON.stringify(SAMPLE_FIELDS)
    const result = parseAigcJson(flat)
    expect(result?.Label).toBe('1')
  })
  it('returns null for empty content', () => {
    expect(parseAigcJson('{}')).toBeNull()
  })
})

describe('parseProducerDisplay', () => {
  it('extracts entity type as 组织', () => {
    const d = parseProducerDisplay('001191110000802100433BY43')
    expect(d.entityType).toBe('组织')
  })
  it('extracts credit code slice', () => {
    const d = parseProducerDisplay('001191110000802100433BY43')
    expect(d.creditCode).toBe('91110000802100433B')
  })
  it('maps known producer', () => {
    const d = parseProducerDisplay('001191110000802100433BY43')
    expect(d.knownName).toBe('字节跳动有限公司')
  })
  it('unknown producer returns undefined', () => {
    const d = parseProducerDisplay('001299999999999999999Y43')
    expect(d.knownName).toBeUndefined()
  })
})

describe('extractFromXmpString', () => {
  it('finds XmpKvBase64 attribute', () => {
    const xmp = `<rdf:Description XmpKvBase64="${btoa(SAMPLE_JSON)}" />`
    const result = extractFromXmpString(xmp)
    expect(result?.Label).toBe('1')
  })
  it('finds AIGC namespace nodes', () => {
    const xmp = `<rdf:Description AIGC:Label="1" AIGC:ContentProducer="001191110000802100433BY43" />`
    const result = extractFromXmpString(xmp)
    expect(result?.Label).toBe('1')
    expect(result?.ContentProducer).toBe('001191110000802100433BY43')
  })
  it('returns null for empty string', () => {
    expect(extractFromXmpString('')).toBeNull()
  })
})

describe('buildAigcResult', () => {
  it('found when Label and ContentProducer present', () => {
    const r = buildAigcResult({ Label: '1', ContentProducer: '001191110000802100433BY43' }, 'XMP')
    expect(r.status).toBe('found')
  })
  it('partial when only Label present', () => {
    const r = buildAigcResult({ Label: '1' }, 'XMP')
    expect(r.status).toBe('partial')
  })
  it('not-found when null', () => {
    const r = buildAigcResult(null, '')
    expect(r.status).toBe('not-found')
  })
})
