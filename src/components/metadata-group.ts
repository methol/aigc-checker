import type { MetaGroup } from '../types.js'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMetaGroup(group: MetaGroup, index: number): string {
  const { id, title, fields, nonDefaultCount } = group
  const open = index === 0
  const badge = nonDefaultCount > 0
    ? `<span class="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-accent-amber/15 text-accent-amber">${nonDefaultCount}</span>`
    : ''

  const rows = fields.map(f => {
    const val = Array.isArray(f.value)
      ? f.value.filter(Boolean).join(', ')
      : String(f.value ?? '—')
    const isND = f.isNonDefault
    const valClass = isND ? 'text-accent-amber' : 'text-text-primary'
    const bar = isND ? 'nondefault-bar pl-2' : ''
    const defNote = f.defaultDesc
      ? `<span class="text-text-muted text-[10px] ml-1">(默认: ${escapeHtml(f.defaultDesc)})</span>`
      : ''
    const desc = f.cnDesc ? `<span class="text-text-muted text-[10px]"> ${escapeHtml(f.cnDesc)}</span>` : ''

    return `
      <div class="flex gap-2 py-1.5 border-b border-surface/40 last:border-0 text-xs ${bar}">
        <span class="text-text-muted shrink-0 w-36">${escapeHtml(f.cnName)}</span>
        <span class="${valClass} font-mono break-all">${escapeHtml(val)}${desc}${defNote}</span>
      </div>`
  }).join('')

  return `
    <details id="group-${id}" class="mb-2 rounded-xl border border-surface bg-card overflow-hidden" ${open ? 'open' : ''}>
      <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-surface/40 transition-colors">
        <span class="text-text-secondary text-sm font-medium">${escapeHtml(title)}</span>
        ${badge}
        <span class="ml-auto text-text-muted text-xs">${fields.length} 项</span>
        <svg class="w-4 h-4 text-text-muted transition-transform details-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7"/>
        </svg>
      </summary>
      <div class="px-4 pb-3 pt-1">${rows}</div>
    </details>`
}
