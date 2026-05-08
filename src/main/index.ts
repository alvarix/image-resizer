import { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } from 'electron'
import { join } from 'path'
import sharp from 'sharp'
import ElectronStore from 'electron-store'
import { loadPresets, savePresets } from './store/presets'
import { appendRun, getRecentRuns } from './store/runlog'
import { runPipeline } from './pipeline/run'
import type { Preset } from '../shared/preset'

const windowStore = new ElectronStore<{ bounds: { width: number; height: number; x?: number; y?: number } }>({
  name: 'window',
  defaults: { bounds: { width: 1000, height: 680 } }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const saved = windowStore.get('bounds')
  mainWindow = new BrowserWindow({
    ...saved,
    minWidth: 720,
    minHeight: 480,
    title: 'ImageResizer',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', () => {
    if (mainWindow) windowStore.set('bounds', mainWindow.getBounds())
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = join(__dirname, '../../build/icon.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ----- IPC handlers -----

ipcMain.handle('dialog:openImages', async (): Promise<string[]> => {
  if (!mainWindow) return []
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'gif']
      }
    ]
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('presets:get', async () => {
  return loadPresets()
})

ipcMain.handle('presets:save', async (_e, presets: Preset[]) => {
  savePresets(presets)
  return true
})

ipcMain.handle(
  'pipeline:run',
  async (e, files: string[], presets: Preset[]) => {
    try {
      const { outputs, errors } = await runPipeline(files, presets, e.sender)
      appendRun({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        files: files.length,
        presets: presets.length,
        outputs,
        errors
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }
)

ipcMain.handle('runlog:get', async () => {
  return getRecentRuns()
})

ipcMain.handle('shell:showInFinder', async (_e, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('preview:get', async (_e, filePath: string): Promise<string> => {
  const buf = await sharp(filePath)
    .rotate()
    .resize({ width: 96, height: 96, fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
})
