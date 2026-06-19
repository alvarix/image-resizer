# Assessment: Inline-Editable Preset Parameters

**Status: implemented** (2026-06-10)

## Problem

Preset parameters (size, PNG colors, WebP/JPEG quality) required clicking into the full editor panel to change. Quick adjustments were tedious.

## Solution

Each preset item in the sidebar now shows inline-editable inputs for its key parameters, always visible:

```
☑ PNG                   ← click name to open full editor
   [1200] px  [4] colors  ← size and PNG colors editable inline
☑ WebP 70 1200
   [1200] px  [===70===]   ← size and quality editable inline
```

- Changing an input updates the preset and persists immediately
- Clicking the preset name opens the full editor (for name, format, delete, duplicate)
- Non-PNG formats show a quality range slider with live value display
- PNG format shows a colors number input
- Values are clamped to valid ranges on change

## Files changed

| File | Change |
|---|---|
| `src/renderer/main.ts` | `buildPresetItem()` renders inline inputs; param change handlers update + persist |
| `src/renderer/styles.css` | New `.preset-params`, `.param-*` classes; `.preset-item` now flex-column |
| `src/renderer/preset-editor.ts` | Reverted to original (no settings param) |
| `src/preload/index.ts` | Reverted to original (no settings bridge) |
| `src/main/index.ts` | Reverted to original (no settings IPC) |
| `src/main/store/settings.ts` | Deleted |
| `src/renderer/index.html` | Reverted (no defaults-bar) |

## Resolved questions

1. Preset parameters are always visible inline in the list (no modals, no separate defaults section).
2. Presets persist immediately on any param change.
3. Changing inline params does NOT open the editor — click the preset name for that.
