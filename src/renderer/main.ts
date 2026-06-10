import './styles.css'
import type { Preset, ProgressEvent, RunEntry } from '../shared/preset'
import { openEditor } from './preset-editor'

// ---- DOM refs ----
const dropZone = document.getElementById('drop-zone') as HTMLElement
const fileListEl = document.getElementById('file-list') as HTMLElement
const pickBtn = document.getElementById('pick-files') as HTMLButtonElement
const runBtn = document.getElementById('run') as HTMLButtonElement
const clearBtn = document.getElementById('clear') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLElement
const addPresetBtn = document.getElementById('add-preset') as HTMLButtonElement
const presetListEl = document.getElementById('preset-list') as HTMLUListElement
const runLogEl = document.getElementById('run-log') as HTMLUListElement

// ---- App state ----
interface AppState {
  files: string[]
  presets: Preset[]
  selectedPresetId: string | null
}

const state: AppState = { files: [], presets: [], selectedPresetId: null }

// ---- Helpers ----
function basename(p: string): string {
  return p.split('/').pop() ?? p
}

function hasEnabledPreset(): boolean {
  return state.presets.some((p) => p.enabled)
}

// ---- Preset sidebar ----
function renderPresets(): void {
  if (state.presets.length === 0) {
    presetListEl.innerHTML = '<li class="preset-empty">No presets. Click + to add one.</li>'
    renderRunBtn()
    return
  }
  presetListEl.innerHTML = state.presets
    .map(
      (p) => `
    <li class="preset-item${state.selectedPresetId === p.id ? ' selected' : ''}" data-id="${p.id}">
      <input type="checkbox" class="preset-check" data-id="${p.id}" ${p.enabled ? 'checked' : ''} />
      <span class="preset-name">${p.name}</span>
    </li>`
    )
    .join('')

  presetListEl.querySelectorAll<HTMLInputElement>('.preset-check').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation()
      const id = cb.dataset.id!
      const preset = state.presets.find((p) => p.id === id)
      if (preset) {
        preset.enabled = cb.checked
        persistPresets()
        renderRunBtn()
      }
    })
  })

  presetListEl.querySelectorAll<HTMLLIElement>('.preset-item').forEach((li) => {
    li.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('preset-check')) return
      const id = li.dataset.id!
      state.selectedPresetId = id
      renderPresets()
      const preset = state.presets.find((p) => p.id === id)!
      openEditor(preset, {
        onSave: (updated) => {
          state.presets = state.presets.map((p) => (p.id === updated.id ? updated : p))
          state.selectedPresetId = null
          persistPresets()
          renderPresets()
          renderRunBtn()
        },
        onDuplicate: (src) => {
          const copy: Preset = {
            ...src,
            id: crypto.randomUUID(),
            name: `${src.name} copy`
          }
          state.presets = [...state.presets, copy]
          state.selectedPresetId = copy.id
          persistPresets()
          renderPresets()
          openEditor(copy, editorCallbacks(copy.id))
        },
        onDelete: (id) => {
          state.presets = state.presets.filter((p) => p.id !== id)
          state.selectedPresetId = null
          persistPresets()
          renderPresets()
          renderRunBtn()
        },
        onCancel: () => {
          state.selectedPresetId = null
          renderPresets()
        }
      })
    })
  })
}

function editorCallbacks(currentId: string) {
  return {
    onSave: (updated: Preset) => {
      state.presets = state.presets.map((p) => (p.id === updated.id ? updated : p))
      state.selectedPresetId = null
      persistPresets()
      renderPresets()
      renderRunBtn()
    },
    onDuplicate: (src: Preset) => {
      const copy: Preset = {
        ...src,
        id: crypto.randomUUID(),
        name: `${src.name} copy`
      }
      state.presets = [...state.presets, copy]
      state.selectedPresetId = copy.id
      persistPresets()
      renderPresets()
      openEditor(copy, editorCallbacks(copy.id))
    },
    onDelete: (id: string) => {
      state.presets = state.presets.filter((p) => p.id !== id)
      state.selectedPresetId = null
      persistPresets()
      renderPresets()
      renderRunBtn()
    },
    onCancel: () => {
      state.selectedPresetId = null
      renderPresets()
    }
  }
}

async function persistPresets(): Promise<void> {
  await window.api.savePresets(state.presets)
}

// ---- File list ----
function renderFiles(): void {
  if (state.files.length === 0) {
    dropZone.hidden = false
    fileListEl.hidden = true
    clearBtn.hidden = true
    renderRunBtn()
    return
  }
  dropZone.hidden = true
  fileListEl.hidden = false
  clearBtn.hidden = false
  fileListEl.innerHTML = state.files
    .map(
      (f, i) =>
        `<div class="file-row" data-idx="${i}">
          <img class="file-thumb" src="" alt="" aria-hidden="true" />
          <div class="file-info">
            <span class="file-name">${basename(f)}</span>
            <span class="file-statuses"></span>
          </div>
          <button class="file-remove" data-idx="${i}" title="Remove">&times;</button>
        </div>`
    )
    .join('')

  fileListEl.querySelectorAll<HTMLButtonElement>('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx)
      state.files = state.files.filter((_, i) => i !== idx)
      renderFiles()
    })
  })

  renderRunBtn()
  loadPreviews()
}

async function loadPreviews(): Promise<void> {
  await Promise.all(
    state.files.map(async (f, i) => {
      try {
        const dataUrl = await window.api.getPreview(f)
        const img = fileListEl.querySelector<HTMLImageElement>(`.file-row[data-idx="${i}"] .file-thumb`)
        if (img) img.src = dataUrl
      } catch {
        // silently skip unreadable files; thumb stays blank
      }
    })
  )
}

function renderRunBtn(): void {
  runBtn.disabled = state.files.length === 0 || !hasEnabledPreset()
}

function addFiles(paths: string[]): void {
  const fresh = paths.filter((p) => !state.files.includes(p))
  if (fresh.length) {
    state.files = [...state.files, ...fresh]
    renderFiles()
  }
}

// ---- File picker ----
pickBtn.addEventListener('click', async () => {
  const paths = await window.api.openImages()
  if (paths.length) addFiles(paths)
})

clearBtn.addEventListener('click', () => {
  state.files = []
  statusEl.textContent = ''
  renderFiles()
})

// ---- Drag and drop ----
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
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

// ---- Add preset ----
addPresetBtn.addEventListener('click', () => {
  const blank: Preset = {
    id: crypto.randomUUID(),
    name: 'New Preset',
    maxLongestSide: 1200,
    format: 'webp',
    quality: 80,
    enabled: true
  }
  state.presets = [...state.presets, blank]
  state.selectedPresetId = blank.id
  persistPresets()
  renderPresets()
  openEditor(blank, editorCallbacks(blank.id))
})

// ---- Run pipeline ----
runBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Running...'
  runBtn.disabled = true
  clearBtn.disabled = true

  const enabledPresets = state.presets.filter((p) => p.enabled)

  // reset status pills
  document.querySelectorAll<HTMLElement>('.file-statuses').forEach((el) => {
    el.textContent = ''
  })

  let processed = 0
  let errors = 0

  const unsubscribe = window.api.onPipelineProgress((evt: ProgressEvent) => {
    const e = evt as unknown as ProgressEvent
    if ((e as { type: string }).type === 'item') {
      const item = e as { type: 'item'; file: string; preset: string; status: 'ok' | 'error'; outPath?: string; error?: string }
      const fileIdx = state.files.indexOf(item.file)
      const statusEl2 = fileIdx >= 0
        ? fileListEl.querySelector<HTMLElement>(`.file-row[data-idx="${fileIdx}"] .file-statuses`)
        : null
      if (statusEl2) {
        const pill = document.createElement('span')
        pill.className = `status-pill ${item.status}`
        pill.textContent = item.preset
        pill.title = item.outPath ?? item.error ?? ''
        if (item.status === 'ok' && item.outPath) {
          const outPath = item.outPath
          pill.style.cursor = 'pointer'
          pill.addEventListener('click', () => window.api.showInFinder(outPath))
        }
        statusEl2.appendChild(pill)
      }
      if (item.status === 'ok') processed++
      else errors++
    }
  })

  const result = await window.api.runPipeline(state.files, enabledPresets)
  unsubscribe()

  if (result.ok) {
    statusEl.textContent = `${processed} output${processed !== 1 ? 's' : ''} written${errors ? `, ${errors} error${errors !== 1 ? 's' : ''}` : ''}`
  } else {
    statusEl.textContent = result.message ?? 'Failed'
  }

  runBtn.disabled = false
  clearBtn.disabled = false
  renderRunBtn()
  await renderRunLog()
})

// ---- Run log ----
function formatRunEntry(r: RunEntry): string {
  const d = new Date(r.timestamp)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const summary = `${r.files} file${r.files !== 1 ? 's' : ''} × ${r.presets} preset${r.presets !== 1 ? 's' : ''} → ${r.outputs} out${r.errors ? `, ${r.errors} err` : ''}`
  return `<li class="run-entry"><span class="run-time">${date} ${time}</span><span class="run-summary">${summary}</span></li>`
}

async function renderRunLog(): Promise<void> {
  const runs: RunEntry[] = await window.api.getRunLog()
  if (runs.length === 0) {
    runLogEl.innerHTML = '<li class="run-empty">No runs yet</li>'
    return
  }
  runLogEl.innerHTML = runs.map(formatRunEntry).join('')
}

// ---- Init ----
async function init(): Promise<void> {
  state.presets = await window.api.getPresets()
  renderPresets()
  renderFiles()
  await renderRunLog()
}

init()
