import ElectronStore from 'electron-store'
import { Preset, DEFAULT_PRESETS } from '../../shared/preset'

interface StoreSchema {
  version: number
  presets: Preset[]
}

const store = new ElectronStore<StoreSchema>({
  name: 'presets',
  defaults: {
    version: 1,
    presets: []
  }
})

/**
 * Load presets from disk. Seeds defaults on first run (empty store).
 * @returns Preset[]
 */
export function loadPresets(): Preset[] {
  const saved = store.get('presets')
  if (!saved || saved.length === 0) {
    store.set('presets', DEFAULT_PRESETS)
    return DEFAULT_PRESETS
  }
  return saved
}

/**
 * Persist presets to disk.
 * @param presets - Array of presets to save
 */
export function savePresets(presets: Preset[]): void {
  store.set('presets', presets)
}
