import type { FileAnalysis, MetaField, MetaGroup } from '../types.js'
import { extractFromXmpString, buildAigcResult } from './aigc.js'

type Track = Record<string, string>

export async function parseVideo(file: File): Promise<FileAnalysis> {
  let tracks: Track[] = []
  try {
    // Dynamic import to avoid loading WASM on non-video files
    const MediaInfoFactory = (await import('mediainfo.js')).default as (opts: unknown) => Promise<{ analyzeData: (getSize: () => number, readChunk: (size: number, offset: number) => Promise<Uint8Array>) => Promise<{ media?: { track: Track[] } }>, close: () => void }>
    const mi = await MediaInfoFactory({ format: 'object' })
    const result = await mi.analyzeData(
      () => file.size,
      (size, offset) =>
        new Promise<Uint8Array>(resolve => {
          const reader = new FileReader()
          reader.onload = e => resolve(new Uint8Array(e.target!.result as ArrayBuffer))
          reader.readAsArrayBuffer(file.slice(offset, offset + size))
        })
    )
    mi.close()
    tracks = result.media?.track ?? []
  } catch {
    // If WASM fails, return minimal result
  }

  const general = tracks.find(t => t['@type'] === 'General')
  const videoTracks = tracks.filter(t => t['@type'] === 'Video')
  const audioTracks = tracks.filter(t => t['@type'] === 'Audio')

  // AIGC from XMP in General track
  const xmpComment = general?.['XMP_com.apple.quicktime.XMP'] ?? general?.['Comment'] ?? general?.['Tagged_Date'] ?? ''
  const aigcFields = extractFromXmpString(xmpComment)
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'moov XMP 元数据' : '')

  const CN_MAP: Record<string, string> = {
    Format: '封装格式', Duration: '时长', FileSize: '文件大小', OverallBitRate: '总码率',
    FrameRate: '帧率', Width: '宽度', Height: '高度', BitDepth: '色深',
    ChromaSubsampling: '色度采样', ColorSpace: '色彩空间',
    Encoded_Application: '编码软件', Encoded_Library: '编码库',
    Title: '标题', Track: '曲目', Album: '专辑', Performer: '作者',
    SamplingRate: '采样率', Channels: '声道数', Compression_Mode: '压缩模式',
  }

  const toFields = (rec: Track): MetaField[] =>
    Object.entries(rec)
      .filter(([k]) => !k.startsWith('@') && rec[k])
      .map(([k, v]) => ({
        key: k,
        value: String(v),
        cnName: CN_MAP[k] ?? k,
        isNonDefault: ['Title', 'Comment', 'Encoded_Application'].includes(k) && !!v,
      }))

  const groups: MetaGroup[] = []
  if (general) groups.push({ id: 'general', title: '容器信息', fields: toFields(general), nonDefaultCount: 0 })
  videoTracks.forEach((t, i) =>
    groups.push({ id: `video${i}`, title: `视频流 ${i + 1}`, fields: toFields(t), nonDefaultCount: 0 }))
  audioTracks.forEach((t, i) =>
    groups.push({ id: `audio${i}`, title: `音频流 ${i + 1}`, fields: toFields(t), nonDefaultCount: 0 }))

  const previewUrl = await captureVideoFrame(file).catch(() => undefined)

  return { file, mediaType: 'video', aigc, groups, previewUrl }
}

function captureVideoFrame(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.preload = 'metadata'
    video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(0.5, video.duration * 0.1) })
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = 240
      canvas.height = Math.round(240 * (video.videoHeight / Math.max(video.videoWidth, 1)))
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }, { once: true })
    video.addEventListener('error', () => { URL.revokeObjectURL(url); reject(new Error('video load failed')) })
    video.load()
    setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('timeout')) }, 10_000)
  })
}
