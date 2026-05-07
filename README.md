# ImageResizer

macOS desktop app for batch-resizing and re-encoding images using configurable presets.

## What it does

Drop one or more images onto the window (or use the file picker). Select which presets to apply via the checkboxes in the sidebar. Click Run. Outputs are written next to each source file as `{originalname}-{presetname}.{ext}`. Click any green output pill to reveal the file in Finder.

Default presets on first launch:
- **PNG 4-color 1200** — palette-quantized PNG, max longest side 1200 px
- **WebP 70 1200** — lossy WebP quality 70, max longest side 1200 px

You can add, edit, duplicate, and delete presets. Presets persist between launches.

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
