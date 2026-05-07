import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Preset } from '../shared/preset'

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
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
