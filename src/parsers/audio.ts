import type { FileAnalysis, MetaField } from '../types.js'
import { parseAigcJson, parseXmpKvBase64, buildAigcResult } from './aigc.js'

export async function parseAudio(file: File): Promise<FileAnalysis> {
  const { parseBlob } = await import('music-metadata-browser')
  const meta = await parseBlob(file, { skipCovers: false })
  const { common, format, native } = meta

  // AIGC: search ID3v2 TXXX frames
  let aigcRaw: string | null = null
  for (const tagFormat of ['ID3v2.3', 'ID3v2.4', 'ID3v2.2']) {
    const tags = native[tagFormat] ?? []
    for (const tag of tags) {
      if (tag.id === 'TXXX' && typeof tag.value === 'object' && tag.value !== null) {
        const txxx = tag.value as { description: string; text: string }
        if (txxx.description === 'AIGC' || txxx.description === 'XmpKvBase64') {
          aigcRaw = txxx.text
          break
        }
      }
    }
    if (aigcRaw) break
  }

  let aigcFields = aigcRaw ? parseAigcJson(aigcRaw) : null
  // Fallback: try base64 decode
  if (!aigcFields && aigcRaw) {
    aigcFields = parseXmpKvBase64(aigcRaw)
  }
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'ID3 TXXX:AIGC' : '')

  const basicFields: MetaField[] = [
    { key: 'title', value: common.title ?? '—', cnName: '标题', isNonDefault: !!common.title },
    { key: 'artist', value: (common.artists ?? [common.artist]).filter(Boolean).join(', ') || '—', cnName: '艺术家/作者', isNonDefault: !!(common.artist || common.artists?.length) },
    { key: 'album', value: common.album ?? '—', cnName: '专辑', isNonDefault: !!common.album },
    { key: 'year', value: common.year ? String(common.year) : '—', cnName: '年份', isNonDefault: !!common.year },
    { key: 'genre', value: common.genre?.join(', ') ?? '—', cnName: '流派', isNonDefault: !!(common.genre?.length) },
    { key: 'comment', value: (common.comment?.[0] as { text?: string } | undefined)?.text ?? '—', cnName: '备注', isNonDefault: !!(common.comment?.length) },
    { key: 'encoder', value: common.encodedby ?? '—', cnName: '编码软件', isNonDefault: !!common.encodedby },
    { key: 'copyright', value: common.copyright ?? '—', cnName: '版权', isNonDefault: !!common.copyright },
  ]

  const formatFields: MetaField[] = [
    { key: 'container', value: format.container ?? '—', cnName: '容器格式', isNonDefault: false },
    { key: 'codec', value: format.codec ?? '—', cnName: '编解码器', isNonDefault: false },
    { key: 'bitrate', value: format.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : '—', cnName: '比特率', isNonDefault: false },
    { key: 'sampleRate', value: format.sampleRate ? `${format.sampleRate} Hz` : '—', cnName: '采样率', isNonDefault: false },
    { key: 'duration', value: format.duration ? `${format.duration.toFixed(2)} s` : '—', cnName: '时长', isNonDefault: false },
    { key: 'channels', value: format.numberOfChannels ?? '—', cnName: '声道数', isNonDefault: false },
    { key: 'lossless', value: format.lossless ? '是' : '否', cnName: '无损格式', isNonDefault: !!format.lossless },
  ]

  return {
    file,
    mediaType: 'audio',
    aigc,
    groups: [
      { id: 'basic', title: '基本信息', fields: basicFields, nonDefaultCount: basicFields.filter(f => f.isNonDefault).length },
      { id: 'format', title: '音频格式', fields: formatFields, nonDefaultCount: formatFields.filter(f => f.isNonDefault).length },
    ],
  }
}
