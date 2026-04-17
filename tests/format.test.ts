import { describe, it, expect } from 'vitest'
import { formatBytes, formatGps, formatExposureTime } from '../src/lib/format.js'

describe('formatBytes', () => {
  it('formats zero', () => expect(formatBytes(0)).toBe('0 B'))
  it('formats bytes', () => expect(formatBytes(512)).toBe('512.00 B'))
  it('formats KB', () => expect(formatBytes(1024)).toBe('1.00 KB'))
  it('formats MB', () => expect(formatBytes(1_500_000)).toBe('1.43 MB'))
})

describe('formatGps', () => {
  it('positive lat is N', () => expect(formatGps(39.9042, 'lat')).toContain('N'))
  it('negative lat is S', () => expect(formatGps(-33.86, 'lat')).toContain('S'))
  it('positive lon is E', () => expect(formatGps(116.4074, 'lon')).toContain('E'))
  it('negative lon is W', () => expect(formatGps(-74.006, 'lon')).toContain('W'))
})

describe('formatExposureTime', () => {
  it('1/100s', () => expect(formatExposureTime(0.01)).toBe('1/100s'))
  it('1/50s', () => expect(formatExposureTime(0.02)).toBe('1/50s'))
  it('1s', () => expect(formatExposureTime(1)).toBe('1s'))
  it('2s', () => expect(formatExposureTime(2)).toBe('2s'))
})
