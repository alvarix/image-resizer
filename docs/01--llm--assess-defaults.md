# Assessment: App-Level Default Settings for New Presets

## Problem

When creating a new preset (clicking "+" in the sidebar), the user always gets the same hardcoded starting values: 1200px, WebP, quality 80, and when switching format to PNG a palette of 4 colors. If the user consistently works at a different size or quality level, they must manually adjust these fields every single time.

There is currently no way to change these defaults.

## Hardcoded values traced

| Location | Value | Context |
|---|---|---|
| `src/renderer/main.ts` (~addPresetBtn click) | `maxLongestSide: 1200, format: 'webp', quality: 80` | Template for brand-new presets |
| `src/renderer/preset-editor.ts` format change handler | `pngColors: 4`, `quality: 80` | When user switches format during editing |
| `src/main/pipeline/encode.ts` fallbacks | `pngColors ?? 4`, `quality ?? 80` | Defensive backstop if preset data is missing fields |
| `src/shared/preset.ts` DEFAULT_PRESETS | `maxLongestSide: 1200, pngColors: 4, quality: 70` | First-launch seed only (not relevant to this change) |

## Design (locked)

A "Defaults" section sits at the top of the sidebar (above the preset list), always visible. It contains three inline-editable inputs:

```
DEFAULTS
  Size  [ 1200 ] px
  PNG   [ 4    ] colors
  Quality [===80===]   (range slider 1-100)
```

- **Size** — number input, 1-20000. Default 1200. Applied as `maxLongestSide` when creating a new preset.
- **PNG colors** — number input, 2-256. Default 4. Applied as `pngColors` when a new preset uses PNG format, and when switching format to PNG in the editor.
- **Quality** — range slider with displayed value, 1-100. Default 80. Applied as `quality` when a new preset uses WebP/JPEG/AVIF, and when switching to those formats in the editor.

Values are persisted via electron-store (`settings.json`). On first launch, defaults are 1200 / 4 / 80.

**How they're consumed:**
- Clicking "+" for a new preset reads all three defaults into the template.
- Switching format while editing a preset pulls the relevant default (PNG colors or quality) from the persisted settings, not from the preset's own prior values.
- The encode pipeline fallbacks (`?? 4`, `?? 80`) remain unchanged as defensive backstops.

**What is NOT included (YAGNI):**
- Default format selector — simple enough to change format when creating the preset.
- Width/height independently — the app uses `maxLongestSide` (fit longest side), not explicit WxH. That's a separate feature.

## Scope of changes

### 1. Shared types

New type in `src/shared/preset.ts`:
```ts
export interface DefaultSettings {
  maxLongestSide: number   // px, default 1200
  pngColors: number        // 2-256, default 4
  quality: number          // 1-100, default 80
}

export const DEFAULT_SETTINGS: DefaultSettings = {
  maxLongestSide: 1200,
  pngColors: 4,
  quality: 80
}
```

### 2. New store file

`src/main/store/settings.ts` — electron-store wrapper, same pattern as `presets.ts`:
```ts
const store = new ElectronStore<DefaultSettings>({ name: 'settings', defaults: DEFAULT_SETTINGS })
export function getSettings(): DefaultSettings
export function saveSettings(s: DefaultSettings): void
```

### 3. IPC handlers

Two new channels in `src/main/index.ts`:
- `settings:get` → `getSettings()`
- `settings:save` → `saveSettings(payload)`

### 4. Preload bridge

New methods in `src/preload/index.ts` and `.d.ts`:
```ts
getSettings(): Promise<DefaultSettings>
saveSettings(settings: DefaultSettings): Promise<boolean>
```

### 5. Renderer — defaults section in sidebar

Insert a "DEFAULTS" block **above** the preset list (between the sidebar header's "+" button and the `<ul id="preset-list">`). Three inline inputs:

```html
<div id="defaults-bar">
  <h4>Defaults</h4>
  <label>Size <input id="def-size" type="number" min="1" max="20000" /></label>
  <label>PNG <input id="def-colors" type="number" min="2" max="256" /> colors</label>
  <label>Quality <input id="def-quality" type="range" min="1" max="100" /> <span id="def-quality-val" /></label>
</div>
```

Save to store on each input's `change` event (debounced or direct — direct is fine, the store handles one write at a time).

### 6. Renderer — wire defaults into new-preset template

In `src/renderer/main.ts`, the add-preset handler reads from the stored defaults instead of hardcoded values:
```ts
const settings = await window.api.getSettings()
const blank: Preset = {
  ...,
  maxLongestSide: settings.maxLongestSide,
  quality: settings.quality,
  // format-specific is set based on default format or user choice
}
```

### 7. Renderer — wire defaults into format-switch handler

In `src/renderer/preset-editor.ts`, the format change listener reads from stored defaults instead of hardcoded `4` and `80`.

### 8. Encode pipeline — no change needed

The `?? 4` and `?? 80` fallbacks in `encode.ts` are a defensive last resort and should remain. They are not the target of this change.

## Files touched

| File | Change |
|---|---|
| `src/shared/preset.ts` | Add `DefaultSettings` type and `DEFAULT_SETTINGS` constant |
| `src/main/store/settings.ts` | **New file** — electron-store wrapper |
| `src/main/index.ts` | Add `settings:get` and `settings:save` IPC handlers |
| `src/preload/index.ts` | Add `getSettings` / `saveSettings` to bridge |
| `src/preload/index.d.ts` | Add type declarations |
| `src/renderer/main.ts` | Use stored defaults in new-preset template; load settings on init |
| `src/renderer/preset-editor.ts` | Use stored defaults in format-switch handler |
| `src/renderer/index.html` | Add defaults section in sidebar |
| `src/renderer/styles.css` | Style the defaults section |

## Edge cases

- User sets zero/default values: fall back to `DEFAULT_SETTINGS`
- User deletes the settings JSON: re-seed from `DEFAULT_SETTINGS`
- Settings store is corrupted/invalid: validate on load, fall back on any field missing
- Format-switch while editing: should pull from settings, not from the preset's own fields (since the user is exploring a different format)

## Resolved questions

1. **Always visible in sidebar** (no modals, no gear icons). Inline editable inputs above the preset list.
2. **Default format not configurable** — new presets start as WebP as they do now. User changes format in the editor.
3. **Defaults do NOT retroactively affect existing presets** — only consumed when creating new presets and when switching format during editing.
