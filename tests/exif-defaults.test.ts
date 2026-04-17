import { describe, it, expect } from 'vitest'
import { isNonDefault } from '../src/dict/exif-defaults.js'

describe('isNonDefault', () => {
  it('Orientation 1 is default', () => expect(isNonDefault('Orientation', 1)).toBe(false))
  it('Orientation 6 is non-default', () => expect(isNonDefault('Orientation', 6)).toBe(true))
  it('Software highlights when present', () => expect(isNonDefault('Software', 'Adobe Photoshop')).toBe(true))
  it('Software empty is default', () => expect(isNonDefault('Software', '')).toBe(false))
  it('GPS highlights when present', () => expect(isNonDefault('GPSLatitude', 39.9042)).toBe(true))
  it('GPS undefined is default', () => expect(isNonDefault('GPSLatitude', undefined)).toBe(false))
  it('unknown key returns false', () => expect(isNonDefault('UnknownField', 99)).toBe(false))
  it('WhiteBalance 0 is default', () => expect(isNonDefault('WhiteBalance', 0)).toBe(false))
  it('WhiteBalance 1 is non-default', () => expect(isNonDefault('WhiteBalance', 1)).toBe(true))
  it('array value is always non-default', () => expect(isNonDefault('Orientation', [1, 0])).toBe(true))
})
