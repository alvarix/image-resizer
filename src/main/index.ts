import {
	app,
	BrowserWindow,
	ipcMain,
	dialog,
	nativeImage,
	shell,
} from "electron";
import { join } from "path";
import sharp from "sharp";
import ElectronStore from "electron-store";
import { loadPresets, savePresets } from "./store/presets";
import { appendRun, getRecentRuns } from "./store/runlog";
import { runPipeline } from "./pipeline/run";
import { toSharpReadablePath } from "./pipeline/heic";
import {
	SUPPORTED_EXTENSIONS,
	SUPPORTED_EXTENSIONS_RE,
	type Preset,
} from "../shared/preset";

const windowStore = new ElectronStore<{
	bounds: { width: number; height: number; x?: number; y?: number };
}>({
	name: "window",
	defaults: { bounds: { width: 1000, height: 680 } },
});

let mainWindow: BrowserWindow | null = null;

/** Files dropped on the Dock icon before the window/renderer was ready */
const pendingDropFiles: string[] = [];

/** Whether the renderer has signaled it is mounted and listening */
let rendererReady = false;

/**
 * Bring the main window to the front, restoring it if minimized.
 */
function focusMainWindow(): void {
	if (!mainWindow) return;
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.focus();
}

/**
 * Forward file paths to the renderer, or buffer them if not ready.
 * Filters out unsupported extensions and notifies the renderer of skipped files.
 * Paths without a file extension are silently dropped — they are likely
 * system artifacts (e.g. the app binary) rather than user-intended drops.
 */
function forwardOrBuffer(files: string[]): void {
	const supported: string[] = [];
	const unsupported: string[] = [];
	for (const f of files) {
		if (SUPPORTED_EXTENSIONS_RE.test(f)) {
			supported.push(f);
		} else if (f.includes(".")) {
			// Only report as unsupported if it looks like a file with an extension;
			// silently drop paths without extensions (app binary, etc.).
			unsupported.push(f);
		}
	}
	if (unsupported.length && mainWindow && rendererReady) {
		mainWindow.webContents.send("unsupported:files", unsupported);
	}
	if (supported.length) {
		if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("dropped:onIcon", supported);
		} else {
			pendingDropFiles.push(...supported);
		}
	}
}

function createWindow(): void {
	const saved = windowStore.get("bounds");
	mainWindow = new BrowserWindow({
		...saved,
		minWidth: 720,
		minHeight: 480,
		title: "ImageResizer",
		titleBarStyle: "hiddenInset",
		backgroundColor: "#1a1a1a",
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	if (process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}

	mainWindow.on("close", () => {
		if (mainWindow) windowStore.set("bounds", mainWindow.getBounds());
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

// ---- Single-instance lock (macOS: routes second activation to this instance) ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
} else {
	app.on("second-instance", (_event: Electron.Event, argv: string[]) => {
		// Windows / Linux: file paths arrive in argv; filter Electron flags.
		// Also filter out the app's own executable path, which macOS includes
		// when files are dropped on the Finder app icon (not the Dock).
		const exePath = app.getPath("exe");
		const files = argv.filter(
			(a) => !a.startsWith("-") && !a.includes("node_modules") && a !== exePath,
		);
		if (files.length) forwardOrBuffer(files);
		focusMainWindow();
	});
}

/**
 * Handle files dropped on the Dock icon or opened via Finder.
 */
function onOpenFile(event: Electron.Event, filePath: string): void {
	event.preventDefault();
	forwardOrBuffer([filePath]);
	focusMainWindow();
}

app.on("open-file", onOpenFile);

app.whenReady().then(() => {
	if (process.platform === "darwin" && app.dock) {
		const iconPath = join(__dirname, "../../build/icon.png");
		app.dock.setIcon(nativeImage.createFromPath(iconPath));
	}

	createWindow();

	// Renderer signals it is mounted and listening — flush buffered files
	ipcMain.on("renderer:ready", () => {
		rendererReady = true;
		if (pendingDropFiles.length > 0 && mainWindow) {
			mainWindow.webContents.send("dropped:onIcon", pendingDropFiles.splice(0));
		}
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
		else focusMainWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

// ----- IPC handlers -----

ipcMain.handle("dialog:openImages", async (): Promise<string[]> => {
	if (!mainWindow) return [];
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openFile", "multiSelections"],
		filters: [
			{
				name: "Images",
				extensions: SUPPORTED_EXTENSIONS,
			},
		],
	});
	return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("presets:get", async () => {
	return loadPresets();
});

ipcMain.handle("presets:save", async (_e, presets: Preset[]) => {
	savePresets(presets);
	return true;
});

ipcMain.handle(
	"pipeline:run",
	async (e, files: string[], presets: Preset[]) => {
		try {
			const { outputs, errors } = await runPipeline(files, presets, e.sender);
			appendRun({
				id: crypto.randomUUID(),
				timestamp: Date.now(),
				files: files.length,
				presets: presets.length,
				outputs,
				errors,
				presetNames: presets.map((p) => p.name),
			});
			return { ok: true };
		} catch (err) {
			return {
				ok: false,
				message: err instanceof Error ? err.message : String(err),
			};
		}
	},
);

ipcMain.handle("runlog:get", async () => {
	return getRecentRuns();
});

ipcMain.handle("shell:showInFinder", async (_e, filePath: string) => {
	shell.showItemInFolder(filePath);
});

ipcMain.handle("app:getVersion", () => {
	return app.getVersion();
});

ipcMain.handle("docs:open", async (_e, which: "readme" | "changelog") => {
	const file = which === "readme" ? "README.md" : "CHANGELOG.md";
	// Packaged builds unpack bundled docs from the asar so the OS can open them.
	const base = app.getAppPath().replace("app.asar", "app.asar.unpacked");
	const error = await shell.openPath(join(base, file));
	return error ? { ok: false, error } : { ok: true };
});

ipcMain.handle("preview:get", async (_e, filePath: string): Promise<string> => {
	const src = await toSharpReadablePath(filePath);
	try {
		const buf = await sharp(src.path)
			.rotate()
			.resize({ width: 96, height: 96, fit: "cover" })
			.jpeg({ quality: 70 })
			.toBuffer();
		return `data:image/jpeg;base64,${buf.toString("base64")}`;
	} finally {
		await src.cleanup();
	}
});
