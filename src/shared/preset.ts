export type OutputFormat = 'png' | 'webp' | 'jpeg' | 'avif'

export interface Preset {
  id: string
  name: string
  maxLongestSide: number
  format: OutputFormat
  /** 2-256, only valid when format === 'png' */
  pngColors?: number
  /** 1-100, only valid when format is webp | jpeg | avif */
  quality?: number
  enabled: boolean
}

export type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'item'; file: string; preset: string; status: 'ok' | 'error'; error?: string; outPath?: string }
  | { type: 'done' }

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'default-png',
    name: 'PNG 4-color 1200',
    maxLongestSide: 1200,
    format: 'png',
    pngColors: 4,
    enabled: true
  },
  {
    id: 'default-webp',
    name: 'WebP 70 1200',
    maxLongestSide: 1200,
    format: 'webp',
    quality: 70,
    enabled: true
  }
]
