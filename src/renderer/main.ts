import './styles.css'

const dropZone = document.getElementById('drop-zone') as HTMLElement
const fileList = document.getElementById('file-list') as HTMLElement
const pickBtn = document.getElementById('pick-files') as HTMLButtonElement
const runBtn = document.getElementById('run') as HTMLButtonElement
const clearBtn = document.getElementById('clear') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLElement

interface State {
  files: string[]
}

const state: State = { files: [] }

function basename(p: string): string {
  return p.split('/').pop() ?? p
}

function render(): void {
  if (state.files.length === 0) {
    dropZone.hidden = false
    fileList.hidden = true
    runBtn.disabled = true
    clearBtn.hidden = true
    return
  }
  dropZone.hidden = true
  fileList.hidden = false
  runBtn.disabled = false
  clearBtn.hidden = false
  fileList.innerHTML = state.files
    .map(
      (f) =>
        `<div class="file-row"><span class="file-name">${basename(
          f
        )}</span><span class="file-path">${f}</span></div>`
    )
    .join('')
}

function addFiles(paths: string[]): void {
  const fresh = paths.filter((p) => !state.files.includes(p))
  if (fresh.length) {
    state.files = [...state.files, ...fresh]
    render()
  }
}

pickBtn.addEventListener('click', async () => {
  const paths = await window.api.openImages()
  if (paths.length) addFiles(paths)
})

clearBtn.addEventListener('click', () => {
  state.files = []
  statusEl.textContent = ''
  render()
})

// Drag and drop
;(['dragenter', 'dragover'] as const).forEach((evt) => {
  dropZone.addEventListener(evt, (e: Event) => {
    e.preventDefault()
    dropZone.classList.add('drag-over')
  })
})
;(['dragleave', 'drop'] as const).forEach((evt) => {
  dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'))
})
dropZone.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer?.files ?? [])
  const paths = files.map((f) => window.api.getPathForFile(f)).filter(Boolean)
  if (paths.length) addFiles(paths)
})

// Prevent the browser from navigating when files are dropped outside the zone
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

runBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Running...'
  runBtn.disabled = true
  const result = await window.api.runPipeline(state.files, [])
  statusEl.textContent = result.message ?? (result.ok ? 'Done' : 'Failed')
  runBtn.disabled = false
})

render()
