# ImageResizer

Mac desktop app for batch-resizing and re-encoding images using configurable presets.

## Status

Scaffold only. UI shell, drag-drop, file picker, IPC bridge, and build config are wired up. The image pipeline, preset editor, and persistence are placeholders.

## Develop

```bash
npm install
npm run dev
```

The first `npm install` builds Sharp's native bindings, which can take a minute.

`npm run dev` opens an Electron window with the UI shell. Drag images in or click "click to select". The Run button currently calls a stubbed pipeline that returns "not implemented yet".

## Build a standalone double-clickable .app

```bash
npm run build:mac
```

Outputs:

- `release/mac/ImageResizer.app` (or `mac-arm64/`, `mac-universal/` depending on host)
- `release/ImageResizer-0.1.0.dmg`

The app is unsigned. To install:

1. Drag `ImageResizer.app` into `/Applications`.
2. The first launch needs right-click in Finder, choose Open. macOS will warn, click Open.
3. From then on, double-click as normal.

If you want notarized, signed builds later, add an Apple Developer ID and remove `"identity": null` from `package.json`.

## Stack

- Electron 33 + electron-vite
- TypeScript (strict)
- Vanilla HTML / CSS / JS in renderer
- Sharp (libvips) for image processing in main process
- electron-store for preset persistence (planned)
- electron-builder for packaging

## Project layout

```
src/
  main/        Electron main process and IPC handlers
  preload/     Context bridge exposing window.api
  renderer/    Vanilla UI: index.html, main.ts, styles.css
```

## Locked spec

- Resize fits longest side, never upscales
- EXIF stripped on export
- Output written next to source as `{originalname}-{presetname}.{ext}`
- Default presets:
  - PNG with 4-color palette, longest side 1200
  - WebP lossy quality 70, longest side 1200
- macOS 13+

## Next phases

1. Preset model + electron-store persistence
2. Preset editor UI (add, edit, delete, duplicate)
3. Sharp pipeline: PNG/WebP/JPEG/AVIF, longest-side fit, EXIF strip
4. Run queue with per-file progress
5. Output naming with collision handling
6. Error states, empty states, polish
7. .dmg packaging verification
