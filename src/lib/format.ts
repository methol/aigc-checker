export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const unit = units[i] ?? 'B'
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${unit}`
}

export function formatGps(decimal: number, axis: 'lat' | 'lon'): string {
  const abs = Math.abs(decimal)
  const deg = Math.floor(abs)
  const minFull = (abs - deg) * 60
  const min = Math.floor(minFull)
  const sec = ((minFull - min) * 60).toFixed(2)
  const dir = axis === 'lat' ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W')
  return `${deg}°${min}'${sec}"${dir}`
}

export function formatExposureTime(secs: number): string {
  if (secs >= 1) return `${secs}s`
  const denom = Math.round(1 / secs)
  return `1/${denom}s`
}

export function formatFNumber(f: number): string {
  return `f/${f.toFixed(1)}`
}
