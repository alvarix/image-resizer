# JXL (JPEG XL) Support Assessment

Date: 2025-07-05

## Summary

JPEG XL cannot be added through Sharp's prebuilt binary alone. Sharp 0.35.3 (latest) ships a `@img/sharp-libvips-darwin-arm64` binary that does **not** compile in libjxl. The `sharp.format.jxl.input/output` flags are all `false` and `.jxl()` throws `"jxlsave_buffer" not found`.

The `cjxl`/`djxl` CLI tools (the reference JPEG XL encoder/decoder) are already installed on this machine at `/opt/homebrew/bin/` (jpeg-xl 0.11.1, NEON SIMD). Shelling out to `cjxl` is the recommended path.

## Options Evaluated

### A: `cjxl` CLI shell-out (recommended)

Pipeline: Sharp resize → temp PNG → `cjxl temp.png out.jxl -q <quality> -e <effort>` → delete temp.

- JXL output encode: yes
- JXL input decode: yes (via `djxl`, but unlikely needed)
- Perf overhead: ~50ms subprocess spawn per file
- Dependency: `brew install jpeg-xl` on user's machine (documented in README)
- Effort: 1-2 hours
- Risk: low — easy migration to native Sharp when prebuilt JXL lands

### B: Rebuild Sharp against system libvips

Sharp 0.35 supports `SHARP_FORCE_GLOBAL_LIBVIPS=true` and Homebrew's `vips` formula includes `jpeg-xl` as a dependency. Rebuilding would give native `.jxl()` support.

- Blocked by broken Homebrew permissions on this machine (`/opt/homebrew/Cellar is not writable`)
- Would also complicate packaging: system libvips .dylibs must be bundled into the .app
- Effort: 1-2 hours + fixing Homebrew + packaging work
- Risk: medium — system libvips on other Macs may differ

### C: Wait for Sharp to bundle JXL in prebuilt

Sharp maintainers have not announced a timeline for prebuilt JXL support. Could be months or years. Not a practical path.

## Code Changes (6 files)

Same files are touched regardless of backend approach.

| File | Change |
| --- | --- |
| `src/shared/preset.ts` | Add `'jxl'` to `OutputFormat`, add `jxlEffort` (1-10) + `jxlLossless` fields to `Preset`, add `.jxl` to `SUPPORTED_EXTENSIONS` and regex |
| `src/main/pipeline/encode.ts` | Add `case 'jxl':` block — either `execFile('cjxl')` or native `sharp().jxl()` |
| `src/renderer/preset-editor.ts` | Add JXL `<option>` in format dropdown, effort range slider, lossless checkbox |
| `src/renderer/main.ts` | Inline param UI wiring for JXL effort/lossless in `buildPresetItem()` |
| `src/main/index.ts` | No change needed (preview handler uses `.jpeg()` which works for all source formats) |
| `package.json` `build.mac.fileAssociations` | Add `"jxl"` to the file associations array |

## cjxl Key Parameters

```
-d DISTANCE     Target visual distance (0.0 = lossless, 1.0 = visually lossless, default for PNG input)
-q QUALITY      Quality 0-100 (100 = lossless, 90 = visually lossless)
-e EFFORT       Encoder effort 1-10 (default 7, higher = smaller files at cost of time)
```

The app's existing `quality` field (1-100) maps directly to `cjxl -q`. Effort can default to 7 with a user override. Lossless mode maps to `-d 0`.

## Migration Path

When Sharp eventually ships JXL in prebuilt binaries, the migration from Path A is:

1. Remove `execFile('cjxl')` from `encode.ts`
2. Replace with `sharp().jxl({ quality, effort, lossless })`
3. Drop `brew install jpeg-xl` from README requirements

~12 lines changed in `encode.ts`, zero changes elsewhere.
