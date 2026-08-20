import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Preset, RunEntry } from '../shared/preset'

const api = {
  openImages: (): Promise<string[]> => ipcRenderer.invoke('dialog:openImages'),
  getPresets: (): Promise<Preset[]> => ipcRenderer.invoke('presets:get'),
  savePresets: (presets: Preset[]): Promise<boolean> =>
    ipcRenderer.invoke('presets:save', presets),
  runPipeline: (
    files: string[],
    presets: Preset[]
  ): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke('pipeline:run', files, presets),
  onPipelineProgress: (
    cb: (event: import('../shared/preset').ProgressEvent) => void
  ): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: import('../shared/preset').ProgressEvent): void =>
      cb(payload)
    ipcRenderer.on('pipeline:progress', handler)
    return () => ipcRenderer.off('pipeline:progress', handler)
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  showInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:showInFinder', filePath),
  getPreview: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('preview:get', filePath),
  getRunLog: (): Promise<RunEntry[]> =>
    ipcRenderer.invoke('runlog:get'),
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:getVersion'),
  openDoc: (which: 'readme' | 'changelog'): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('docs:open', which),
  onDroppedOnIcon: (cb: (paths: string[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, paths: string[]): void => cb(paths)
    ipcRenderer.on('dropped:onIcon', handler)
    return () => ipcRenderer.off('dropped:onIcon', handler)
  },
  notifyReady: (): void => ipcRenderer.send('renderer:ready'),
  onUnsupportedFiles: (cb: (paths: string[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, paths: string[]): void => cb(paths)
    ipcRenderer.on('unsupported:files', handler)
    return () => ipcRenderer.off('unsupported:files', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
