import type { FileAnalysis, MediaType } from '../types.js'

export function detectMediaType(file: File): MediaType {
  const mime = file.type.toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff', 'avif'].includes(ext)) return 'image'
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  if (mime.startsWith('audio/') || ['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a'].includes(ext)) return 'audio'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') return 'docx'
  return 'unknown'
}

export async function analyzeFile(file: File): Promise<FileAnalysis> {
  const mediaType = detectMediaType(file)
  try {
    switch (mediaType) {
      case 'image': {
        const { parseImage } = await import('../parsers/image.js')
        return await parseImage(file)
      }
      case 'video': {
        const { parseVideo } = await import('../parsers/video.js')
        return await parseVideo(file)
      }
      case 'audio': {
        const { parseAudio } = await import('../parsers/audio.js')
        return await parseAudio(file)
      }
      case 'pdf': {
        const { parsePdf } = await import('../parsers/pdf.js')
        return await parsePdf(file)
      }
      case 'docx': {
        const { parseDocx } = await import('../parsers/docx.js')
        return await parseDocx(file)
      }
      default:
        return {
          file,
          mediaType: 'unknown',
          aigc: { status: 'not-found', fields: {}, source: '' },
          groups: [],
          error: '不支持的文件类型',
        }
    }
  } catch (err) {
    return {
      file,
      mediaType,
      aigc: { status: 'not-found', fields: {}, source: '' },
      groups: [],
      error: err instanceof Error ? err.message : '解析失败',
    }
  }
}
