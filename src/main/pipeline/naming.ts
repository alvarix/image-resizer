import { dirname, parse, join } from 'path'
import { existsSync } from 'fs'

/**
 * Build a collision-safe output path next to the source file.
 * Format: {dir}/{basename}-{presetName}.{ext}
 * If the candidate exists, suffix with " (1)", " (2)", etc.
 *
 * @param srcPath - Absolute path to the source image
 * @param presetName - Human-readable preset name
 * @param ext - Output file extension without leading dot
 */
export function outputPath(srcPath: string, presetName: string, ext: string): string {
  const dir = dirname(srcPath)
  const base = parse(srcPath).name
  const safePreset = presetName.replace(/[^a-z0-9\-_ ]/gi, '_').trim()
  let candidate = join(dir, `${base}-${safePreset}.${ext}`)
  let n = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}-${safePreset} (${n}).${ext}`)
    n++
  }
  return candidate
}
