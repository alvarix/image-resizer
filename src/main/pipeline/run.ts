import os from 'os'
import type { WebContents } from 'electron'
import type { Preset, ProgressEvent } from '../../shared/preset'
import { encode } from './encode'
import { outputPath } from './naming'

/**
 * Run files × enabled presets through the Sharp encoder.
 * Emits ProgressEvents to the renderer via webContents.send.
 * Concurrency is capped to avoid over-parallelizing Sharp's own thread pool.
 *
 * @param files - Absolute paths to source images
 * @param presets - Enabled presets to apply to every file
 * @param sender - WebContents to receive pipeline:progress events
 */
export async function runPipeline(
  files: string[],
  presets: Preset[],
  sender: WebContents
): Promise<void> {
  const total = files.length * presets.length
  sender.send('pipeline:progress', { type: 'start', total } satisfies ProgressEvent)

  const concurrency = Math.max(2, os.cpus().length - 1)

  // Build flat list of work items
  const jobs: Array<{ file: string; preset: Preset }> = []
  for (const file of files) {
    for (const preset of presets) {
      jobs.push({ file, preset })
    }
  }

  // Process in fixed-size windows
  let idx = 0
  async function runNext(): Promise<void> {
    while (idx < jobs.length) {
      const job = jobs[idx++]
      const ext = job.preset.format === 'jpeg' ? 'jpg' : job.preset.format
      const out = outputPath(job.file, job.preset.name, ext)
      try {
        await encode(job.file, out, job.preset)
        sender.send('pipeline:progress', {
          type: 'item',
          file: job.file,
          preset: job.preset.name,
          status: 'ok',
          outPath: out
        } satisfies ProgressEvent)
      } catch (err) {
        sender.send('pipeline:progress', {
          type: 'item',
          file: job.file,
          preset: job.preset.name,
          status: 'error',
          error: err instanceof Error ? err.message : String(err)
        } satisfies ProgressEvent)
      }
    }
  }

  const workers = Array.from({ length: concurrency }, runNext)
  await Promise.all(workers)

  sender.send('pipeline:progress', { type: 'done' } satisfies ProgressEvent)
}
