import type { MetaValue } from '../types.js'

export interface DefaultRule {
  defaultValue: MetaValue
  defaultDesc: string
  isAlwaysHighlight?: boolean
}

export const EXIF_DEFAULTS: Record<string, DefaultRule> = {
  Orientation: { defaultValue: 1, defaultDesc: '1（正常方向）' },
  ResolutionUnit: { defaultValue: 2, defaultDesc: '2（英寸）' },
  YCbCrPositioning: { defaultValue: 1, defaultDesc: '1（居中）' },
  ColorSpace: { defaultValue: 1, defaultDesc: '1（sRGB）' },
  WhiteBalance: { defaultValue: 0, defaultDesc: '0（自动白平衡）' },
  ExposureMode: { defaultValue: 0, defaultDesc: '0（自动曝光）' },
  ExposureProgram: { defaultValue: 0, defaultDesc: '0（未定义）' },
  MeteringMode: { defaultValue: 0, defaultDesc: '0（未知）' },
  SceneCaptureType: { defaultValue: 0, defaultDesc: '0（标准场景）' },
  CustomRendered: { defaultValue: 0, defaultDesc: '0（正常处理）' },
  GainControl: { defaultValue: 0, defaultDesc: '0（无增益调整）' },
  Contrast: { defaultValue: 0, defaultDesc: '0（正常）' },
  Saturation: { defaultValue: 0, defaultDesc: '0（正常）' },
  Sharpness: { defaultValue: 0, defaultDesc: '0（正常）' },
  Software: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  ImageDescription: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  Artist: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  Copyright: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  UserComment: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  GPSLatitude: { defaultValue: undefined, defaultDesc: '无（不含 GPS 信息）', isAlwaysHighlight: true },
  GPSLongitude: { defaultValue: undefined, defaultDesc: '无（不含 GPS 信息）', isAlwaysHighlight: true },
  GPSAltitude: { defaultValue: undefined, defaultDesc: '无', isAlwaysHighlight: true },
}

export function isNonDefault(key: string, value: MetaValue | MetaValue[]): boolean {
  const rule = EXIF_DEFAULTS[key]
  if (!rule) return false
  if (rule.isAlwaysHighlight) {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  }
  if (Array.isArray(value)) return true
  return value !== rule.defaultValue
}
