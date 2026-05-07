import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 680,
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

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ----- IPC stubs (real implementations land in next phase) -----

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
  // TODO: load from electron-store
  return []
})

ipcMain.handle('presets:save', async (_e, _presets: unknown) => {
  // TODO: save to electron-store
  return true
})

ipcMain.handle(
  'pipeline:run',
  async (_e, _files: string[], _presets: unknown[]) => {
    // TODO: implement Sharp pipeline
    return { ok: false, message: 'Pipeline not implemented yet' }
  }
)
