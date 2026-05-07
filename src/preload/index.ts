import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  openImages: (): Promise<string[]> => ipcRenderer.invoke('dialog:openImages'),
  getPresets: (): Promise<unknown[]> => ipcRenderer.invoke('presets:get'),
  savePresets: (presets: unknown[]): Promise<boolean> =>
    ipcRenderer.invoke('presets:save', presets),
  runPipeline: (
    files: string[],
    presets: unknown[]
  ): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke('pipeline:run', files, presets),
  // Resolve absolute path of a File from drag-drop. Required in Electron 32+
  // because File.path was removed.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
