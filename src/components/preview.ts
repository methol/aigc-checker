import type { FileAnalysis } from '../types.js'
import { formatBytes } from '../lib/format.js'

export function renderPreview(analysis: FileAnalysis): string {
  const { file, mediaType, previewUrl } = analysis
  const size = formatBytes(file.size)
  const name = file.name

  let previewHtml = ''
  if (previewUrl && mediaType === 'image') {
    previewHtml = `
      <img src="${previewUrl}" alt="${name}"
        class="w-full max-h-48 object-contain rounded-lg bg-surface mb-3" />`
  } else if (previewUrl && mediaType === 'video') {
    previewHtml = `
      <div class="relative w-full max-h-48 rounded-lg overflow-hidden bg-surface mb-3">
        <img src="${previewUrl}" alt="${name}" class="w-full max-h-48 object-contain" />
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <svg class="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>`
  }

  const iconMap: Record<string, string> = {
    image: '🖼',
    video: '🎬',
    audio: '🎵',
    pdf: '📄',
    docx: '📝',
    unknown: '📁',
  }

  return `
    <div class="rounded-xl border border-surface bg-card p-4 mb-4">
      ${previewHtml}
      <div class="flex items-center gap-3">
        <span class="text-2xl">${iconMap[mediaType] ?? '📁'}</span>
        <div class="min-w-0">
          <p class="text-text-primary text-sm font-medium truncate">${name}</p>
          <p class="text-text-muted text-xs">${size} · ${mediaType.toUpperCase()}</p>
        </div>
      </div>
    </div>`
}
