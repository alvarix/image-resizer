# ImageResizer

macOS desktop app for batch-resizing and re-encoding images using configurable presets.

Mac binary:
release/mac-arm64/ImageResizer.app 


## What it does

Drop one or more images onto the window (or use the file picker). Each file shows a thumbnail preview. Select which presets to apply via the checkboxes in the sidebar. Click Run. Outputs are written next to each source file as `{originalname}-{presetname}.{ext}`. Click any green output pill to reveal the file in Finder.

The sidebar also shows a log of the last 10 runs (date, time, files × presets → outputs).

Default presets on first launch:
- **PNG** — palette-quantized PNG (4 colors), max longest side 1200 px
- **WebP** — lossy WebP quality 70, max longest side 1200 px

HEIC/HEIF files are supported as input (decoded via macOS `sips`); the app never produces HEIC output.

You can add, edit, duplicate, and delete presets. Presets and run history persist between launches.


## Running the release
### Note for macOS Users ("App is damaged" error)

Because this app is not currently signed with a paid Apple Developer certificate, macOS Gatekeeper will block it upon download and show a misleading error stating **"App is damaged and can't be opened."**

To fix this and safely open the app, run a quick cleanup command in your Mac Terminal:

1. Open your **Terminal** app (Press `Cmd + Space`, type "Terminal", and hit Enter).
2. Copy and paste the following command, then press **Enter**:
   ```bash
   xattr -cr. /ImageResizer.app
   ```
   *(Be sure to replace `YOUR_APP_NAME.app` with the actual name of the app in your Applications folder).*

You only need to run this command once. After that, the app will open normally like any other software!




## Develop

```bash
npm install
npm run dev
```

`npm install` builds Sharp's native bindings, which can take a minute on first run.

## Build a standalone .app

```bash
npm run build:mac
```

Outputs:
- `release/mac/ImageResizer.app` (or `mac-arm64/` depending on host)
- `release/ImageResizer-0.1.0.dmg`

The app is unsigned. To open on first launch: right-click the `.app` in Finder, choose Open, click Open on the warning. Double-click works normally after that.

## Rebuild the app icon

```bash
bash scripts/build-icon.sh
```

Requires `build/icon.png` (1024x1024 master). Compiles `build/icon.icns` from the iconset.

## Stack

- Electron 33 + electron-vite
- TypeScript (strict)
- Vanilla HTML / CSS / JS in renderer
- Sharp (libvips) — image resizing and encoding
- electron-store — preset and window-state persistence
- electron-builder — packaging

## Project layout

```
src/
  shared/
    preset.ts          Preset type, ProgressEvent type, default presets
  main/
    index.ts           App lifecycle, IPC handlers
    store/
      presets.ts       electron-store wrapper for preset persistence
    pipeline/
      encode.ts        Per-format Sharp calls
      heic.ts          HEIC/HEIF pre-decode via macOS sips
      naming.ts        Collision-safe output filename builder
      run.ts           Concurrent orchestrator, emits progress events
  preload/
    index.ts           Context bridge (window.api)
  renderer/
    index.html
    main.ts            UI: file list, drag-drop, run, progress
    preset-editor.ts   Inline preset CRUD editor
    styles.css
build/
  icon.png             1024x1024 master icon
  icon.icns            Compiled multi-resolution icon
scripts/
  build-icon.sh        Compiles icon.icns from icon.png
```

## Spec

See `docs/spec.md` for locked decisions, phase plan, and open questions.
