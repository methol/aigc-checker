import './styles.css'
import { createDropzone } from './components/dropzone.js'
import { renderPreview } from './components/preview.js'
import { renderAigcCard } from './components/aigc-card.js'
import { renderMetaGroup } from './components/metadata-group.js'
import { exportJson } from './lib/export.js'
import { analyzeFile } from './lib/router.js'
import type { FileAnalysis } from './types.js'

const SAMPLES = [
  { label: '样例图片', file: '/samples/sample.jpg', icon: '🖼' },
  { label: '样例音频', file: '/samples/sample.mp3', icon: '🎵' },
  { label: '样例 PDF', file: '/samples/sample.pdf', icon: '📄' },
]

function buildShell(): { app: HTMLElement; resultArea: HTMLElement } {
  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="max-w-2xl mx-auto px-4 pt-safe pb-safe min-h-dvh flex flex-col">
      <header class="py-6 mb-2">
        <h1 class="text-xl font-bold text-text-primary tracking-tight">
          AIGC <span class="text-accent-cyan">Checker</span>
        </h1>
        <p class="text-text-muted text-xs mt-0.5">AI 内容水印检测 · GB 45438-2025</p>
      </header>

      <div id="dropzone-slot" class="mb-4"></div>

      <div id="samples-bar" class="flex gap-2 flex-wrap mb-5">
        ${SAMPLES.map(s => `
          <button data-sample="${s.file}"
            class="sample-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                   border border-surface bg-card text-text-secondary
                   hover:border-accent-cyan/40 hover:text-accent-cyan transition-colors
                   min-h-[44px] active:scale-95">
            <span>${s.icon}</span>
            <span>${s.label}</span>
          </button>`).join('')}
      </div>

      <div id="result" class="flex-1"></div>

      <footer class="py-4 text-center text-text-muted text-[10px]">
        本地解析 · 不上传服务器
      </footer>
    </div>`

  return { app, resultArea: document.getElementById('result')! }
}

function showLoading(resultArea: HTMLElement, name: string) {
  resultArea.innerHTML = `
    <div class="rounded-xl border border-surface bg-card p-6 text-center mb-4 animate-pulse">
      <div class="w-8 h-8 rounded-full border-2 border-accent-cyan border-t-transparent
                  animate-spin mx-auto mb-3"></div>
      <p class="text-text-secondary text-sm">正在解析 ${name}…</p>
    </div>`
}

function renderResult(analysis: FileAnalysis, resultArea: HTMLElement) {
  if (analysis.error) {
    resultArea.innerHTML = `
      <div class="rounded-xl border border-accent-red/30 bg-card p-4 mb-4">
        <p class="text-accent-red text-sm font-medium mb-1">解析失败</p>
        <p class="text-text-muted text-xs">${analysis.error}</p>
      </div>`
    return
  }

  const exportBtn = `
    <button id="export-btn"
      class="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface bg-card
             text-text-secondary text-sm hover:border-accent-cyan/40 hover:text-accent-cyan
             transition-colors min-h-[44px] w-full justify-center mb-4">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
      </svg>
      导出 JSON
    </button>`

  const groups = analysis.groups
    .map((g, i) => renderMetaGroup(g, i))
    .join('')

  resultArea.innerHTML =
    renderPreview(analysis) +
    renderAigcCard(analysis.aigc) +
    exportBtn +
    `<div class="space-y-1">${groups}</div>`

  document.getElementById('export-btn')?.addEventListener('click', () => {
    exportJson(analysis)
  })
}

async function handleFile(file: File, resultArea: HTMLElement) {
  showLoading(resultArea, file.name)
  const analysis = await analyzeFile(file)
  renderResult(analysis, resultArea)
}

async function loadSample(path: string, resultArea: HTMLElement) {
  showLoading(resultArea, path.split('/').pop() ?? 'sample')
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const name = path.split('/').pop() ?? 'sample'
    const file = new File([blob], name, { type: blob.type })
    const analysis = await analyzeFile(file)
    renderResult(analysis, resultArea)
  } catch (err) {
    resultArea.innerHTML = `
      <div class="rounded-xl border border-accent-red/30 bg-card p-4 mb-4">
        <p class="text-accent-red text-sm font-medium mb-1">加载样例失败</p>
        <p class="text-text-muted text-xs">${err instanceof Error ? err.message : '未知错误'}</p>
      </div>`
  }
}

function init() {
  const { resultArea } = buildShell()

  const dropzoneSlot = document.getElementById('dropzone-slot')!
  const dropzone = createDropzone((files) => {
    if (files[0]) handleFile(files[0], resultArea)
  })
  dropzoneSlot.appendChild(dropzone)

  document.getElementById('samples-bar')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.sample-btn')
    if (!btn) return
    const path = btn.dataset['sample']
    if (path) loadSample(path, resultArea)
  })
}

init()
