import ElectronStore from 'electron-store'
import type { RunEntry } from '../../shared/preset'

const MAX_ENTRIES = 10

const store = new ElectronStore<{ runs: RunEntry[] }>({
  name: 'runlog',
  defaults: { runs: [] }
})

/**
 * Append a run entry, keeping only the last MAX_ENTRIES.
 * @param entry - Run summary to store
 */
export function appendRun(entry: RunEntry): void {
  const runs = store.get('runs')
  runs.push(entry)
  if (runs.length > MAX_ENTRIES) runs.splice(0, runs.length - MAX_ENTRIES)
  store.set('runs', runs)
}

/**
 * Return up to MAX_ENTRIES recent runs, newest first.
 */
export function getRecentRuns(): RunEntry[] {
  return [...store.get('runs')].reverse()
}
