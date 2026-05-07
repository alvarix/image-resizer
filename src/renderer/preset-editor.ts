import type { Preset, OutputFormat } from '../shared/preset'

interface EditorCallbacks {
  onSave: (preset: Preset) => void
  onDuplicate: (preset: Preset) => void
  onDelete: (id: string) => void
  onCancel: () => void
}

const panel = document.getElementById('editor-panel') as HTMLElement

/**
 * Render the preset editor into #editor-panel and show it.
 * @param preset - The preset being edited (pass a clone for new presets)
 * @param callbacks - Save/duplicate/delete/cancel handlers
 */
export function openEditor(preset: Preset, callbacks: EditorCallbacks): void {
  panel.hidden = false
  panel.innerHTML = buildForm(preset)
  wireForm(preset, callbacks)
}

/** Hide and empty the editor panel. */
export function closeEditor(): void {
  panel.hidden = true
  panel.innerHTML = ''
}

function buildForm(p: Preset): string {
  const isQuality = p.format !== 'png'
  return `
    <form id="preset-form" class="preset-form" novalidate>
      <h3 class="editor-title">${p.name}</h3>

      <label class="field-label">
        Name
        <input id="f-name" type="text" value="${esc(p.name)}" maxlength="80" required />
        <span class="field-error" id="err-name"></span>
      </label>

      <label class="field-label">
        Max longest side (px)
        <input id="f-size" type="number" value="${p.maxLongestSide}" min="1" max="20000" required />
        <span class="field-error" id="err-size"></span>
      </label>

      <label class="field-label">
        Format
        <select id="f-format">
          <option value="png" ${p.format === 'png' ? 'selected' : ''}>PNG</option>
          <option value="webp" ${p.format === 'webp' ? 'selected' : ''}>WebP</option>
          <option value="jpeg" ${p.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
          <option value="avif" ${p.format === 'avif' ? 'selected' : ''}>AVIF</option>
        </select>
      </label>

      <div id="format-options">
        ${isQuality ? qualityField(p.quality ?? 80) : colorsField(p.pngColors ?? 4)}
      </div>

      <div class="editor-actions">
        <button type="submit" id="btn-save" class="btn-primary">Save</button>
        <button type="button" id="btn-dup"    class="btn-secondary">Duplicate</button>
        <button type="button" id="btn-delete" class="btn-danger">Delete</button>
        <button type="button" id="btn-cancel" class="btn-secondary">Cancel</button>
      </div>
    </form>`
}

function qualityField(value: number): string {
  return `
    <label class="field-label">
      Quality (1-100)
      <div class="range-row">
        <input id="f-quality" type="range" min="1" max="100" value="${value}" />
        <span id="quality-val">${value}</span>
      </div>
      <span class="field-error" id="err-quality"></span>
    </label>`
}

function colorsField(value: number): string {
  return `
    <label class="field-label">
      Palette colors (2-256)
      <input id="f-colors" type="number" min="2" max="256" value="${value}" />
      <span class="field-error" id="err-colors"></span>
    </label>`
}

function wireForm(original: Preset, cb: EditorCallbacks): void {
  const form = document.getElementById('preset-form') as HTMLFormElement
  const nameEl   = document.getElementById('f-name')    as HTMLInputElement
  const sizeEl   = document.getElementById('f-size')    as HTMLInputElement
  const formatEl = document.getElementById('f-format')  as HTMLSelectElement
  const optsEl   = document.getElementById('format-options') as HTMLElement

  // swap quality/colors section when format changes
  formatEl.addEventListener('change', () => {
    optsEl.innerHTML =
      formatEl.value === 'png'
        ? colorsField(original.pngColors ?? 4)
        : qualityField(original.quality ?? 80)
    wireRangeDisplay()
  })

  wireRangeDisplay()

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!validate()) return
    cb.onSave(readPreset(original.id, original.enabled))
    closeEditor()
  })

  document.getElementById('btn-dup')!.addEventListener('click', () => {
    if (!validate()) return
    cb.onDuplicate(readPreset(original.id, original.enabled))
    closeEditor()
  })

  document.getElementById('btn-delete')!.addEventListener('click', () => {
    if (confirm(`Delete preset "${original.name}"?`)) {
      cb.onDelete(original.id)
      closeEditor()
    }
  })

  document.getElementById('btn-cancel')!.addEventListener('click', () => {
    cb.onCancel()
    closeEditor()
  })
}

function wireRangeDisplay(): void {
  const rangeEl = document.getElementById('f-quality') as HTMLInputElement | null
  const valEl   = document.getElementById('quality-val') as HTMLElement | null
  if (rangeEl && valEl) {
    rangeEl.addEventListener('input', () => { valEl.textContent = rangeEl.value })
  }
}

function readPreset(id: string, enabled: boolean): Preset {
  const fmt = (document.getElementById('f-format') as HTMLSelectElement).value as OutputFormat
  const p: Preset = {
    id,
    name: (document.getElementById('f-name') as HTMLInputElement).value.trim(),
    maxLongestSide: parseInt((document.getElementById('f-size') as HTMLInputElement).value, 10),
    format: fmt,
    enabled
  }
  if (fmt === 'png') {
    p.pngColors = parseInt((document.getElementById('f-colors') as HTMLInputElement).value, 10)
  } else {
    p.quality = parseInt((document.getElementById('f-quality') as HTMLInputElement).value, 10)
  }
  return p
}

function validate(): boolean {
  let ok = true

  const name = (document.getElementById('f-name') as HTMLInputElement).value.trim()
  const errName = document.getElementById('err-name')!
  if (!name) {
    errName.textContent = 'Name is required'
    ok = false
  } else {
    errName.textContent = ''
  }

  const size = parseInt((document.getElementById('f-size') as HTMLInputElement).value, 10)
  const errSize = document.getElementById('err-size')!
  if (isNaN(size) || size < 1 || size > 20000) {
    errSize.textContent = 'Must be 1-20000'
    ok = false
  } else {
    errSize.textContent = ''
  }

  const fmt = (document.getElementById('f-format') as HTMLSelectElement).value
  if (fmt === 'png') {
    const colors = parseInt((document.getElementById('f-colors') as HTMLInputElement).value, 10)
    const errColors = document.getElementById('err-colors')!
    if (isNaN(colors) || colors < 2 || colors > 256) {
      errColors.textContent = 'Must be 2-256'
      ok = false
    } else {
      errColors.textContent = ''
    }
  } else {
    const q = parseInt((document.getElementById('f-quality') as HTMLInputElement).value, 10)
    const errQ = document.getElementById('err-quality')!
    if (isNaN(q) || q < 1 || q > 100) {
      errQ.textContent = 'Must be 1-100'
      ok = false
    } else {
      errQ.textContent = ''
    }
  }

  return ok
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
