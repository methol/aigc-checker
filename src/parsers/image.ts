import type { FileAnalysis, MetaGroup, MetaField, MetaValue } from '../types.js'
import { extractFromXmpString, buildAigcResult } from './aigc.js'
import { EXIF_CN } from '../dict/exif-cn.js'
import { EXIF_DEFAULTS, isNonDefault } from '../dict/exif-defaults.js'
import { formatGps, formatExposureTime, formatFNumber } from '../lib/format.js'

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (key === 'GPSLatitude' && typeof value === 'number') return formatGps(value, 'lat')
  if (key === 'GPSLongitude' && typeof value === 'number') return formatGps(value, 'lon')
  if (key === 'ExposureTime' && typeof value === 'number') return formatExposureTime(value)
  if (key === 'FNumber' && typeof value === 'number') return formatFNumber(value)
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.join(', ')
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

function toMetaField(key: string, raw: unknown): MetaField {
  const meta = EXIF_CN[key]
  const displayVal = formatValue(key, raw)
  const rule = EXIF_DEFAULTS[key]
  const nonDefault = isNonDefault(key, raw as MetaValue)
  return {
    key,
    value: displayVal,
    cnName: meta?.name ?? key,
    cnDesc: meta?.unit,
    isNonDefault: nonDefault,
    defaultValue: rule?.defaultValue,
    defaultDesc: rule?.defaultDesc,
  }
}

function groupFromRecord(id: string, title: string, icon: string, record: Record<string, unknown>): MetaGroup {
  const fields = Object.entries(record)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => toMetaField(k, v))
  return {
    id,
    title,
    icon,
    fields,
    nonDefaultCount: fields.filter(f => f.isNonDefault).length,
  }
}

export async function parseImage(file: File): Promise<FileAnalysis> {
  const { default: Exifr } = await import('exifr')
  const parsed = await Exifr.parse(file, {
    tiff: true,
    exif: true,
    gps: true,
    iptc: true,
    icc: true,
    jfif: true,
    xmp: true,
    mergeOutput: false,
  }) as Record<string, Record<string, unknown>> | null

  const previewUrl = URL.createObjectURL(file)

  // AIGC watermark: search in XMP
  const xmpData = parsed?.['xmp'] ?? {}
  const xmpStr = JSON.stringify(xmpData)
  const aigcFields = extractFromXmpString(xmpStr)

  // Also check XmpKvBase64 directly if exifr exposed it
  let finalAigcFields = aigcFields
  if (!finalAigcFields && xmpData['XmpKvBase64'] && typeof xmpData['XmpKvBase64'] === 'string') {
    const { parseXmpKvBase64 } = await import('./aigc.js')
    finalAigcFields = parseXmpKvBase64(xmpData['XmpKvBase64'] as string)
  }

  const aigc = buildAigcResult(finalAigcFields, finalAigcFields ? 'XMP 元数据' : '')

  const groups: MetaGroup[] = []

  if (parsed?.['ifd0'] && Object.keys(parsed['ifd0']).length)
    groups.push(groupFromRecord('camera', '相机信息', 'camera', parsed['ifd0']))
  if (parsed?.['exif'] && Object.keys(parsed['exif']).length)
    groups.push(groupFromRecord('exif', '拍摄参数', 'aperture', parsed['exif']))

  const gpsRaw = parsed?.['gps'] ?? {}
  const gpsFields: Record<string, unknown> = {}
  if (gpsRaw['GPSLatitude']) gpsFields['GPSLatitude'] = gpsRaw['GPSLatitude']
  if (gpsRaw['GPSLongitude']) gpsFields['GPSLongitude'] = gpsRaw['GPSLongitude']
  if (gpsRaw['GPSAltitude']) gpsFields['GPSAltitude'] = gpsRaw['GPSAltitude']
  if (gpsRaw['GPSDateStamp']) gpsFields['GPSDateStamp'] = gpsRaw['GPSDateStamp']
  if (gpsRaw['GPSTimeStamp']) gpsFields['GPSTimeStamp'] = gpsRaw['GPSTimeStamp']
  if (Object.keys(gpsFields).length)
    groups.push(groupFromRecord('gps', 'GPS 定位', 'map-pin', gpsFields))

  if (parsed?.['xmp'] && Object.keys(parsed['xmp']).length)
    groups.push(groupFromRecord('xmp', 'XMP 元数据', 'tag', parsed['xmp']))
  if (parsed?.['iptc'] && Object.keys(parsed['iptc']).length)
    groups.push(groupFromRecord('iptc', 'IPTC 信息', 'file-text', parsed['iptc']))
  if (parsed?.['icc'] && Object.keys(parsed['icc']).length)
    groups.push(groupFromRecord('icc', 'ICC 色彩配置', 'palette', parsed['icc']))

  return { file, mediaType: 'image', aigc, groups, previewUrl }
}
