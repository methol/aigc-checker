import type { AigcResult } from '../types.js'
import { AIGC_FIELD_CN, LABEL_VALUES } from '../dict/aigc-cn.js'
import { parseProducerDisplay } from '../parsers/aigc.js'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderAigcCard(aigc: AigcResult): string {
  const { status, fields, source } = aigc

  if (status === 'not-found') {
    return `
      <div class="rounded-xl border border-surface bg-card p-4 mb-4">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-text-muted text-sm">●</span>
          <span class="text-text-secondary text-sm font-medium">未检测到 AIGC 水印</span>
        </div>
        <p class="text-text-muted text-xs">此文件未嵌入 GB 45438-2025 标准水印信息</p>
      </div>`
  }

  const statusColor = status === 'found' ? 'accent-cyan' : 'accent-amber'
  const statusIcon = status === 'found' ? '◉' : '◎'
  const statusText = status === 'found' ? '检测到完整 AIGC 水印' : '检测到部分 AIGC 水印'

  const labelVal = fields.Label ? (LABEL_VALUES[fields.Label] ?? fields.Label) : '—'

  let producerHtml = ''
  if (fields.ContentProducer && fields.ContentProducer.length >= 4) {
    const p = parseProducerDisplay(fields.ContentProducer)
    producerHtml = `
      <div class="mt-2 rounded-lg bg-surface/50 p-3 text-xs font-mono space-y-1">
        ${p.knownName ? `<div><span class="text-text-muted">机构名称：</span><span class="text-accent-cyan">${esc(p.knownName)}</span></div>` : ''}
        <div><span class="text-text-muted">主体类型：</span><span class="text-text-secondary">${esc(p.entityType)}</span></div>
        <div><span class="text-text-muted">统一信用代码：</span><span class="text-text-primary">${esc(p.creditCode)}</span></div>
        ${p.serviceCode !== '—' ? `<div><span class="text-text-muted">业务码：</span><span class="text-text-secondary">${esc(p.serviceCode)}</span></div>` : ''}
      </div>`
  }

  const rows = Object.entries(AIGC_FIELD_CN)
    .map(([key, cn]) => {
      const val = fields[key as keyof typeof fields] || '—'
      const isMain = key === 'ContentProducer' && fields.ContentProducer && fields.ContentProducer.length >= 4
      return `
        <div class="flex gap-2 py-1.5 border-b border-surface/60 last:border-0 text-xs">
          <span class="text-text-muted w-36 shrink-0">${cn}</span>
          <span class="text-text-primary font-mono break-all">${val === '—' ? '<span class="text-text-muted">—</span>' : esc(val)}</span>
        </div>
        ${key === 'ContentProducer' && isMain ? producerHtml : ''}`
    })
    .join('')

  return `
    <div class="rounded-xl border border-${statusColor}/30 bg-card aigc-glow p-4 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-${statusColor} text-base">${statusIcon}</span>
        <span class="text-${statusColor} text-sm font-semibold">${statusText}</span>
        <span class="ml-auto text-text-muted text-xs">${esc(source)}</span>
      </div>
      <div class="mb-2 flex items-center gap-2">
        <span class="text-xs px-2 py-0.5 rounded-full bg-${statusColor}/10 text-${statusColor} font-medium">
          ${labelVal}
        </span>
      </div>
      <div class="divide-y divide-surface/40">${rows}</div>
    </div>`
}
