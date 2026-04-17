export type DropzoneCallback = (files: FileList) => void

export function createDropzone(onFiles: DropzoneCallback): HTMLElement {
  const el = document.createElement('div')
  el.className = 'dropzone relative rounded-2xl border-2 border-dashed border-surface transition-colors p-8 text-center cursor-pointer hover:border-accent-cyan/50'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', '点击或拖拽文件到此处')

  el.innerHTML = `
    <input type="file" class="sr-only" id="file-input"
      accept="image/*,video/*,audio/*,.pdf,.docx,.doc"
      capture="environment" />
    <div class="pointer-events-none space-y-3">
      <div class="mx-auto w-14 h-14 rounded-2xl bg-surface flex items-center justify-center">
        <svg class="w-7 h-7 text-accent-cyan" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
        </svg>
      </div>
      <div>
        <p class="text-text-primary text-sm font-medium">点击上传或拖拽文件</p>
        <p class="text-text-muted text-xs mt-1">图片 · 视频 · 音频 · PDF · DOCX</p>
      </div>
    </div>`

  const input = el.querySelector<HTMLInputElement>('#file-input')!

  const trigger = () => input.click()
  el.addEventListener('click', trigger)
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger() }
  })

  input.addEventListener('change', () => {
    if (input.files?.length) onFiles(input.files)
    input.value = ''
  })

  el.addEventListener('dragover', e => {
    e.preventDefault()
    el.classList.add('border-accent-cyan', 'bg-accent-cyan/5')
    el.classList.remove('border-surface')
  })
  el.addEventListener('dragleave', () => {
    el.classList.remove('border-accent-cyan', 'bg-accent-cyan/5')
    el.classList.add('border-surface')
  })
  el.addEventListener('drop', e => {
    e.preventDefault()
    el.classList.remove('border-accent-cyan', 'bg-accent-cyan/5')
    el.classList.add('border-surface')
    if (e.dataTransfer?.files.length) onFiles(e.dataTransfer.files)
  })

  return el
}
