# HEIC (HEIF/HEVC) Input Support Assessment

Date: 2025-07-05

## Scope

HEIC is **input-only**. The app never outputs HEIC. This assessment covers reading `.heic`/`.heif` source files. No new output format, no dropdown entry, no `Preset` changes.

## Summary

Sharp's prebuilt binary **cannot decode HEIC**. The `heif` format handler supports only AV1 (AVIF), not HEVC (HEIC). Pixel decode fails with `heif: Error while loading plugin: Support for this compression format has not been built in (11.6003)`.

This is a **licensing wall, not a technical omission**. HEVC/x265 is patent- and GPL-encumbered, so Sharp (Apache-2.0) will never bundle HEVC in prebuilt binaries. No upstream fix is coming.

macOS has native HEIC decode via `sips` (already at `/usr/bin/sips`, zero install). Shelling out to `sips` is the only practical path.

## Current State — Latent Bug

The app already lists `heic` and `heif` in `SUPPORTED_EXTENSIONS` and `SUPPORTED_EXTENSIONS_RE` (`src/shared/preset.ts`). This means:

- Dropping a `.heic`/`.heif` file passes the extension filter.
- `preview:get` (`src/main/index.ts:220`) calls `sharp().rotate().resize().jpeg()` with no try/catch → unhandled rejection, broken thumbnail.
- `encode()` (`src/main/pipeline/encode.ts`) calls `sharp(srcPath).rotate().resize(...)` → throws the same way.

Sharp's `.metadata()` on a HEIC file succeeds (reads only the container header, reports `format: "heif"`), but any pixel read throws. This creates the false impression that HEIC works.

## The Fix — Single Decode Shim

Both call sites funnel through `sharp(srcPath)`. A single helper removes the need to touch the pipeline logic:

```
toSharpReadablePath(filePath):
  if extension is not .heic/.heif (case-insensitive) → return filePath unchanged
  else → sips -s format png filePath --out <temp>.png → return <temp>.png
```

Then:

- `encode()` uses `sharp(await toSharpReadablePath(srcPath))` and deletes the temp PNG in a `finally` block.
- `preview:get` does the same, plus a try/catch so a bad file returns a graceful error instead of an unhandled rejection.

Verified working: HEIC → PNG via `sips` → Sharp reads metadata and pixels correctly.

## Code Changes

| File | Change |
| --- | --- |
| `src/main/pipeline/heic.ts` (new) | `toSharpReadablePath()` helper wrapping the `sips` conversion |
| `src/main/pipeline/encode.ts` | Use the helper at the top of `encode()`; cleanup temp in `finally` |
| `src/main/index.ts` | Use the helper in `preview:get`; add try/catch |
| `src/shared/preset.ts` | No change (extensions already list `heic`/`heif`) |
| `package.json` `build.mac.fileAssociations` | Verify `heic`/`heif` present for double-click-to-open (input concern) |

## Effort

~1–1.5 hours: one new helper (~20 lines), two call-site edits (~5 lines each), one test file, plus manual verification with a real `.heic` file.

## Notes

- `sips` is macOS-only; the app is already macOS-only, so no portability loss.
- The `sips` subprocess is spawned once per HEIC source file (not per preset), so batch runs with multiple presets only pay the conversion cost once per file.
- No quality tradeoff applies here — `sips` is only used to decode to a lossless PNG intermediate; Sharp then does the resizing and encoding exactly as today.
