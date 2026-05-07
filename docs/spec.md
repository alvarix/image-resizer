# ImageResizer Spec

Working spec for continuing development from the scaffold. Anyone (or any AI session) picking this up should be able to read this doc top-to-bottom and know what to build next, in what order, and why.

## 1. Product summary

A macOS desktop app that takes one or more image files (drag-drop or file picker) and writes resized, re-encoded copies according to user-defined presets. Each preset is a tuple of (name, max longest side in px, output format, format-specific options). Presets are editable in the app and persist between launches. The app is a real standalone `.app` bundle, double-clickable from `/Applications`.

## 2. Locked decisions

- Stack: Electron 33 + electron-vite + TypeScript (strict). Vanilla HTML/CSS/JS in renderer. Sharp for image processing in main process. electron-store for persistence. electron-builder for packaging.
- macOS 13+, unsigned for now (right-click Open on first launch).
- Resize: fit longest side to target px, never upscale.
- EXIF: stripped by default on export.
- Output: written to source folder as `{originalname}-{presetname}.{ext}`. If file exists, suffix with ` (1)`, ` (2)`, etc.
- Default presets shipped on first launch:
  1. Name `PNG 4-color 1200`, format `png`, max 1200, palette colors 4
  2. Name `WebP 70 1200`, format `webp`, max 1200, quality 70
- All four formats supported: PNG, WebP, JPEG, AVIF.

## 3. Current state (scaffold complete)

What's already in the repo:

- `package.json` with all dependencies, scripts, and electron-builder mac config
- `electron.vite.config.ts`
- `tsconfig.json` + `tsconfig.node.json` + `tsconfig.web.json`
- `src/main/index.ts`: window creation, IPC handler stubs for `dialog:openImages`, `presets:get`, `presets:save`, `pipeline:run`
- `src/preload/index.ts` + `index.d.ts`: typed `window.api` bridge including `getPathForFile` for drag-drop
- `src/renderer/index.html` + `main.ts` + `styles.css`: dark UI shell with sidebar, drop zone, file list, run bar
- `README.md`, `.gitignore`

What works today:

- `npm run dev` opens a window with the UI
- Drag-drop or file picker populates a file list
- `npm run build:mac` produces a `.app` and `.dmg` in `release/`

What's stubbed:

- `presets:get` returns `[]`
- `presets:save` returns `true` without writing
- `pipeline:run` returns `{ ok: false, message: "Pipeline not implemented yet" }`
- Sidebar shows two hardcoded placeholder list items
- Add-preset button is disabled

## 4. Next phases (in order)

Each phase is a single focused chunk. Build, verify, commit, move on.

### Phase A: App icon

**Goal**: ship an `.icns` file and wire it into the build so the dock icon, Finder icon, and About-window icon all show it.

**Design direction (suggested, open to revision)**: A macOS-style rounded squircle. Centered motif: a stylized photo frame with a small "scale" or "arrow" indicator implying resize. Two-tone palette using the app's accent blue (`#4a9eff`) on a darker background, or a lighter monochrome treatment if preferred. Keep it readable at 16x16.

**Deliverables**:

- `build/icon.png` (1024x1024 master, 32-bit PNG, transparent background)
- `build/icon.icns` (compiled multi-resolution icon, generated from the master)
- `build/icon.iconset/` (intermediate, gitignored)

**How to compile `.icns` from master PNG (macOS native)**:

```bash
# From repo root, with build/icon.png in place
mkdir -p build/icon.iconset
sips -z 16 16     build/icon.png --out build/icon.iconset/icon_16x16.png
sips -z 32 32     build/icon.png --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32     build/icon.png --out build/icon.iconset/icon_32x32.png
sips -z 64 64     build/icon.png --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128   build/icon.png --out build/icon.iconset/icon_128x128.png
sips -z 256 256   build/icon.png --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256   build/icon.png --out build/icon.iconset/icon_256x256.png
sips -z 512 512   build/icon.png --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512   build/icon.png --out build/icon.iconset/icon_512x512.png
cp build/icon.png build/icon.iconset/icon_512x512@2x.png
iconutil -c icns build/icon.iconset -o build/icon.icns
```

Add a `scripts/build-icon.sh` wrapper for this.

**electron-builder wiring**: Add to `build` block in `package.json`:

```json
"mac": {
  "icon": "build/icon.icns",
  ...existing mac config
}
```

For the dock icon during `npm run dev`, set it explicitly in `src/main/index.ts`:

```ts
import { app, nativeImage } from 'electron'
import { join } from 'path'

if (process.platform === 'darwin' && app.dock) {
  const iconPath = join(__dirname, '../../build/icon.png')
  app.dock.setIcon(nativeImage.createFromPath(iconPath))
}
```

**Verify**: `npm run build:mac`, drag the `.app` to `/Applications`, confirm icon appears in Finder, dock, and Cmd-Tab switcher at all sizes.

### Phase B: Preset persistence

**Goal**: replace the stub `presets:get` / `presets:save` with electron-store-backed persistence. Seed defaults on first launch.

**Files**:

- `src/main/store/presets.ts` (new): wraps electron-store, exports `loadPresets()`, `savePresets(presets)`, exports `DEFAULT_PRESETS`.
- `src/shared/preset.ts` (new): shared TS types used by main and renderer.

**Type**:

```ts
export type OutputFormat = 'png' | 'webp' | 'jpeg' | 'avif'

export interface Preset {
  id: string                  // uuid
  name: string                // user-editable
  maxLongestSide: number      // px
  format: OutputFormat
  pngColors?: number          // 2-256, only when format === 'png'
  quality?: number            // 1-100, only when format in webp/jpeg/avif
  enabled: boolean
}
```

**Defaults**:

```ts
export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'default-png',
    name: 'PNG 4-color 1200',
    maxLongestSide: 1200,
    format: 'png',
    pngColors: 4,
    enabled: true
  },
  {
    id: 'default-webp',
    name: 'WebP 70 1200',
    maxLongestSide: 1200,
    format: 'webp',
    quality: 70,
    enabled: true
  }
]
```

**Storage**: electron-store v8 (CJS). File at `~/Library/Application Support/ImageResizer/presets.json`. Schema includes a `version` integer for future migrations.

**Wire-up**: update `presets:get` handler to call `loadPresets()`, seeding defaults if empty. Update `presets:save` to call `savePresets`. Renderer fetches via `window.api.getPresets()` on load, renders into sidebar.

**Verify**: launch fresh, two defaults appear. Edit nothing, relaunch, still two. Delete the JSON file manually, relaunch, defaults come back.

### Phase C: Preset editor UI

**Goal**: full CRUD on presets from the sidebar.

**Renderer additions**:

- Click a preset row → opens an inline editor panel on the right (pushes file list down or replaces drop zone temporarily).
- Editor fields: name (text), max longest side (number), format (select), then conditional fields:
  - `png` → palette colors stepper (2-256, default 4)
  - `webp` / `jpeg` / `avif` → quality slider (1-100, default 70)
- Buttons: Save, Duplicate, Delete, Cancel.
- Add button in sidebar header creates a new preset with sensible defaults and opens the editor.
- Each preset row shows a checkbox for `enabled` (used at run time).

**Files**:

- `src/renderer/preset-editor.ts`: standalone module rendering the editor into a slot in `index.html`.
- Update `src/renderer/main.ts` to wire selection, save (calls `window.api.savePresets`), and re-render sidebar.

**Validation**:

- Name: non-empty, trimmed
- maxLongestSide: integer, 1-20000
- pngColors: integer, 2-256
- quality: integer, 1-100

Show inline validation errors, disable Save until valid.

**Verify**: create, edit, duplicate, delete presets. Quit and relaunch, changes persist.

### Phase D: Sharp pipeline

**Goal**: real `pipeline:run` that processes files through enabled presets.

**Files**:

- `src/main/pipeline/encode.ts`: per-format encoders.
- `src/main/pipeline/naming.ts`: collision-safe output filename builder.
- `src/main/pipeline/run.ts`: orchestrator. Iterates files × enabled presets. Reports progress via `webContents.send('pipeline:progress', payload)`.

**Per-format Sharp calls**:

```ts
// PNG with palette
sharp(input)
  .rotate()                                  // honor orientation before strip
  .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
  .png({ palette: true, colours: preset.pngColors, compressionLevel: 9 })
  .toFile(out)

// WebP lossy
sharp(input)
  .rotate()
  .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: preset.quality })
  .toFile(out)

// JPEG
sharp(input)
  .rotate()
  .resize(...same...)
  .jpeg({ quality: preset.quality, mozjpeg: true })
  .toFile(out)

// AVIF
sharp(input)
  .rotate()
  .resize(...same...)
  .avif({ quality: preset.quality })
  .toFile(out)
```

Note: Sharp strips EXIF by default unless `withMetadata()` is called. The `.rotate()` with no args reads EXIF orientation and bakes it in before metadata is dropped, so visual orientation is preserved.

**Concurrency**: cap with a small queue, `Math.max(2, os.cpus().length - 1)`. Sharp itself is multi-threaded so don't over-parallelize at the JS level.

**Naming** (`naming.ts`):

```ts
function outputPath(srcPath: string, presetName: string, ext: string): string {
  const dir = dirname(srcPath)
  const base = parse(srcPath).name
  const safePreset = presetName.replace(/[^a-z0-9-_ ]/gi, '_').trim()
  let candidate = join(dir, `${base}-${safePreset}.${ext}`)
  let n = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}-${safePreset} (${n}).${ext}`)
    n++
  }
  return candidate
}
```

**Progress messages**:

```ts
type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'item'; file: string; preset: string; status: 'ok' | 'error'; error?: string; outPath?: string }
  | { type: 'done' }
```

**Renderer updates**: subscribe via `window.api.onPipelineProgress(cb)` (add to preload). Update each file row with per-preset status pills.

**Verify**: drop 5 mixed images (PNG, JPEG, HEIC), run with both default presets, check files written next to sources, confirm sizes are sane (the `4-color PNG` should be tiny), open in Preview to confirm visual integrity.

### Phase E: Polish

- Empty states (no files, no presets)
- Error states (unreadable file, encoding failure, disk full)
- Disabled state on Run button when no presets enabled
- "Open in Finder" link on each output after run
- Toast or summary line: "12 files processed, 0 errors"
- Persist window size

### Phase F: Distribution

- Verify `.dmg` opens cleanly, app launches from `/Applications` after right-click Open
- Custom DMG background (optional, nice-to-have)
- Document the right-click Open dance in README (already there, expand)
- Future: sign + notarize when an Apple Developer ID is available

## 5. IPC contract (current and planned)

| Channel | Direction | Args | Returns | Status |
|---|---|---|---|---|
| `dialog:openImages` | renderer→main | none | `string[]` paths | Implemented |
| `presets:get` | renderer→main | none | `Preset[]` | Stubbed (Phase B) |
| `presets:save` | renderer→main | `Preset[]` | `boolean` | Stubbed (Phase B) |
| `pipeline:run` | renderer→main | `(files: string[], presets: Preset[])` | `{ ok, message? }` | Stubbed (Phase D) |
| `pipeline:progress` | main→renderer | `ProgressEvent` | none | Planned (Phase D) |

## 6. Project layout (target after all phases)

```
image-resizer/
  package.json
  electron.vite.config.ts
  tsconfig.json
  tsconfig.node.json
  tsconfig.web.json
  build/
    icon.png
    icon.icns
  scripts/
    build-icon.sh
  src/
    shared/
      preset.ts
    main/
      index.ts
      ipc.ts
      store/
        presets.ts
      pipeline/
        run.ts
        encode.ts
        naming.ts
    preload/
      index.ts
      index.d.ts
    renderer/
      index.html
      main.ts
      styles.css
      preset-editor.ts
  release/                  (gitignored)
  out/                      (gitignored)
  node_modules/             (gitignored)
  README.md
  SPEC.md
  .gitignore
```

## 7. Open questions

- Icon design: do you want me to draft an SVG concept for the icon, or do you have a design in mind?
- Should "Run" only act on enabled presets, or should there be a per-run preset multiselect on top?
- When source and target format are the same and target is larger than source (resize skipped), should we still re-encode (apply quality, strip EXIF) or skip entirely?
- HEIC inputs: Sharp can read them on macOS. Do you want HEIC as an output format option too?

Default answers if not specified, in this order: 1) I'll draft an icon SVG, 2) enabled-only, no per-run multiselect, 3) re-encode (so EXIF stripping always happens), 4) read HEIC as input but no HEIC output for v1.

## 8. Working agreement

- Don't write code to files without explicit ask, even in `~/Sites/apps`. Diffs first when in doubt.
- No commits or pushes without approval. Show commit drafts.
- Each phase ships as one commit (or a small handful), with the SPEC checked off.
