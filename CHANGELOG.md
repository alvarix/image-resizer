# Changelog

## [Unreleased]

### Added
- Phase A: app icon compiled from `avatar-cat.svg` via `scripts/build-icon.sh`; wired into electron-builder mac config and dev dock
- Phase B: `src/shared/preset.ts` — `Preset` and `ProgressEvent` types, default presets
- Phase B: `src/main/store/presets.ts` — electron-store wrapper, seeds defaults on first run
- Phase C: preset sidebar renders live presets with enabled checkboxes
- Phase C: `src/renderer/preset-editor.ts` — full CRUD editor panel (name, size, format, quality/colors, save, duplicate, delete, cancel)
- Phase D: `src/main/pipeline/naming.ts` — collision-safe output filename builder
- Phase D: `src/main/pipeline/encode.ts` — per-format Sharp encoders (PNG palette, WebP, JPEG mozjpeg, AVIF)
- Phase D: `src/main/pipeline/run.ts` — concurrent orchestrator, emits `pipeline:progress` events to renderer
- Phase E: window size/position persisted across launches
- Phase E: clicking an output pill reveals the file in Finder
- Phase E: empty preset list shows a prompt to add one
