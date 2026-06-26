# Assessment: Drag images onto the app icon to open them

Status: assessment only (not implemented). Target: macOS (primary), Electron 33 + electron-vite + electron-builder.

## 1. Feature summary

Let the user drag image files onto the ImageResizer **Dock icon** (or use Finder
"Open With" / double-click an associated image) to open them in the app. On launch
the file(s) should load into the existing file list; if the app is already running
they should be added to the running window and the window focused.

Windows/Linux are out of scope to *validate* now, but the file-path-via-`argv`
handling is cheap to add defensively for future cross-platform support.

## 2. Headline finding — this is ~70-80% already built

The in-app plumbing already exists and is wired end to end. The actual blocker is a
single missing piece of OS registration. Verified against source:

| Piece | Status | Evidence |
|---|---|---|
| `app.on('open-file', onOpenFile)` registered before `ready` | present, correct | `src/main/index.ts:65` |
| Early-file buffer | present | `pendingDropFiles` `src/main/index.ts:18` |
| Buffer flush on window load | present | `did-finish-load` flush `src/main/index.ts:76-78` |
| IPC push channel `dropped:onIcon` | present | `src/main/index.ts:59,78` |
| Preload bridge `onDroppedOnIcon` (returns unsubscribe) | present | `src/preload/index.ts:29` |
| Renderer consumes it via `addFiles()` | present | `src/renderer/main.ts:412` |
| **`mac.fileAssociations` (OS routing)** | **MISSING** | `package.json` mac block `:41-48`, no key |
| Single-instance lock / `second-instance` | missing | none in `src/main/index.ts` |
| Renderer-ready race | fragile | see below |

**Why it currently won't work:** without `mac.fileAssociations`, electron-builder
writes no `CFBundleDocumentTypes` into the packaged `Info.plist`. macOS therefore
never registers `ImageResizer.app` as a handler for image types, so the Dock icon
rejects dropped images and `open-file` never fires. Everything downstream is ready
and waiting.

## 3. What the external reference teaches

(Electron + electron-builder API behavior; canonical docs — confirm against pinned
versions before shipping.)

- `open-file` is **macOS-only** and can fire **before** `app` `ready`; the listener
  must be registered at module top level (already done here). Must call
  `event.preventDefault()` (already done). Fires **once per file** — multi-file drops
  arrive as several events.
- `mac.fileAssociations` is what writes `CFBundleDocumentTypes` and makes the OS route
  files to the app. Fields: `ext` (no dot), `name`, `role` (`Editor`/`Viewer`), mac
  `rank` (`Owner`/`Default`/`Alternate`/`None`). For common image types, prefer
  `Alternate` rank so we don't hijack the user's default image handler.
- Associations only take effect on a **packaged, Launch-Services-registered** build —
  not in `electron-vite dev`. Test with the built `.app`, ideally moved to
  `/Applications`; `lsregister -f` can force re-registration.
- Already-running case: on macOS the OS delivers `open-file` to the existing instance.
  A single-instance lock (`app.requestSingleInstanceLock()` + `second-instance`) is the
  belt-and-suspenders path and the only path on Windows/Linux (paths via `argv`).
- Forward paths to the renderer over a preload-exposed channel; gate the flush on a
  renderer "ready" signal to avoid sending before the listener is attached.
- Unsigned app (`identity: null` here): Gatekeeper/Launch Services registration can be
  flaky; first launch may need right-click → Open and the app in `/Applications`.

## 4. What the local codebase implies — integration points

- `src/main/index.ts`
  - `onOpenFile` + `pendingDropFiles` (`:18`, `:59-61`), registered `:65`, flushed `:76-78`.
  - No single-instance lock. `activate` recreates a closed window but does not focus a
    minimized one.
  - Existing IPC is `invoke/handle` for request/response; the icon path correctly uses
    one-way `webContents.send` + `ipcRenderer.on` — reuse this, don't invent a channel.
  - Dialog filter extension list (the canonical set) lives here:
    `png, jpg, jpeg, webp, avif, heic, heif, tif, tiff, gif`.
- `src/preload/index.ts:29` — `onDroppedOnIcon` already exposed; mirror its convention.
- `src/renderer/main.ts`
  - `addFiles(paths)` (`:275`) is the single funnel for picker, in-window DnD, and icon
    drop; it dedups + re-renders but does **not** auto-run, and does **not** filter by
    extension.
  - **Race:** `init()` (`:406`) does `await window.api.getPresets()` (`:407`) *before*
    registering `onDroppedOnIcon` (`:412`). Files flushed by `did-finish-load` can land
    before the listener exists and be silently lost.
- `package.json` mac block `:41-48` — add `fileAssociations` here. App is unsigned
  (`identity: null` `:47`).
- No test runner or tests exist. Scripts: `typecheck` and `build:mac`.

## 5. Recommended approach (minimal, safe)

Keep the architecture. Four surgical changes:

1. **Add `mac.fileAssociations`** to `package.json` (the required fix). Mirror the
   dialog extension list. Use `role: "Viewer"` (app derives sibling files, never
   overwrites originals) and consider `rank: "Alternate"` to avoid claiming default
   handler status for all images.
2. **Fix the renderer-ready race.** Preferred: register `onDroppedOnIcon` at the *top*
   of `init()` before the `await`, and add an explicit `renderer:ready` IPC that main
   uses to flush `pendingDropFiles` (guarantees the listener exists before flush).
   Minimal alternative: just reorder the listener registration above the `await`.
3. **Add a single-instance lock + `second-instance` handler** that forwards `argv` file
   paths to the same `dropped:onIcon` path and focuses/restores the window. Mostly
   cross-platform hygiene; macroOS keeps using `open-file`.
4. **Filter unsupported types** on the icon path (and optionally in `addFiles`, which
   also closes a pre-existing in-window-DnD gap where any file type is accepted).

Optional tidy-up: extract the canonical extension list into `src/shared/preset.ts` so
the dialog filter, `fileAssociations`, and the guard stay in sync.

## 6. Likely files to change

| File | Change | Why |
|---|---|---|
| `package.json` | add `mac.fileAssociations` | the required OS registration (the actual fix) |
| `src/main/index.ts` | single-instance lock, `second-instance`, focus helper, type filter, optional `renderer:ready` flush | already-running/cross-platform + race fix |
| `src/preload/index.ts` | optional `notifyReady()` channel | race fix Option A |
| `src/renderer/main.ts` | register `onDroppedOnIcon` before `await`; optional `notifyReady()`; optional extension guard in `addFiles` | race fix + consistency |
| `src/shared/preset.ts` | optional shared extension constant | dedupe the list |

## 7. Constraints and non-goals

- Do not change Sharp / `asarUnpack` packaging.
- Keep `open-file` registered before `whenReady`.
- Match existing JSDoc + strict-TS style.
- Non-goals: code signing/notarization, Mac App Store sandbox + security-scoped
  bookmarks, custom per-association document icons, auto-processing on drop (unless
  explicitly approved).

## 8. Validation

- `npm run typecheck` (both tsconfigs) must pass.
- `npm run build:mac`, then confirm `CFBundleDocumentTypes` is present:
  `/usr/libexec/PlistBuddy -c "Print :CFBundleDocumentTypes" release/mac*/ImageResizer.app/Contents/Info.plist`
- Manual: move `.app` to `/Applications`, launch once, then:
  - app closed → drag image onto icon → app opens with file loaded;
  - app running → drop on Dock icon → file added, window focused;
  - app minimized → drop → window restores + file added;
  - drop 3 images at once → all 3 appear, no dupes;
  - drop a `.txt` → ignored.
- If Finder won't route after build, force re-register:
  `lsregister -f release/mac*/ImageResizer.app` then retest.
- No GUI automation exists; the testable-in-isolation unit is a pure
  `filterImages`/extension-guard helper if the list is extracted.

## 9. Risks and open questions (need user decision)

1. **Auto-run vs stage:** should dropping on the icon just populate the list (current
   behavior) or immediately run enabled presets?
2. **Race fix:** explicit `renderer:ready` handshake (recommended) vs simple reorder.
3. **`role`:** `Viewer` (recommended) vs `Editor`.
4. **Breadth of claim:** registering for common types (png/jpg) makes the app appear in
   "Open With" system-wide. Acceptable, or narrow the set / use `rank: "Alternate"`?
5. **Unsupported-type UX:** silent drop (recommended) vs visible status message.
6. **Also fix in-window DnD type gap** and **extract the shared extension constant**? (recommended yes.)
7. **Unsigned-app caveat:** associations may need the app in `/Applications` + Launch
   Services refresh; acceptable for now, or is signing in scope later?

---

## 10. Implementation-ready meta-prompt (for the next worker/planner)

> **Goal:** Make dragging image files onto the ImageResizer macOS Dock icon (and Finder
> "Open With"/double-click) open them in the app. The in-app pipeline already works; the
> primary fix is registering macOS file associations.
>
> **Verified context:** `open-file` → `dropped:onIcon` IPC → preload `onDroppedOnIcon`
> (`src/preload/index.ts:29`) → renderer `addFiles` (`src/renderer/main.ts:275`, registered
> `:412`) already exists. Buffer `pendingDropFiles` (`src/main/index.ts:18`) flushes on
> `did-finish-load` (`:76-78`). MISSING: `mac.fileAssociations` in `package.json` mac block
> (`:41-48`). RACE: `init()` awaits `getPresets()` (`src/renderer/main.ts:407`) before
> registering the listener (`:412`). Canonical extension list:
> `png,jpg,jpeg,webp,avif,heic,heif,tif,tiff,gif`.
>
> **Do:**
> 1. Add `mac.fileAssociations` to `package.json` mirroring the extension list,
>    `role: "Viewer"`, consider `rank: "Alternate"`.
> 2. Fix the race: register `onDroppedOnIcon` at the top of `init()` before the await; add
>    an explicit `renderer:ready` IPC that main uses to flush `pendingDropFiles`.
> 3. Add `app.requestSingleInstanceLock()` + `second-instance` forwarding `argv` image paths
>    to `dropped:onIcon` and a `focusMainWindow()` (restore + show + focus).
> 4. Filter unsupported types on the icon path (and in `addFiles` to also fix in-window DnD).
> 5. Optional: extract the extension list into `src/shared/preset.ts`.
>
> **Constraints:** keep `open-file` before `whenReady`; don't touch Sharp/asar config;
> match JSDoc + strict-TS; reuse the existing one-way send/on IPC pattern (no new channel
> beyond `renderer:ready`).
>
> **Validate:** `npm run typecheck`; `npm run build:mac`; inspect `CFBundleDocumentTypes`
> via PlistBuddy; manual Dock-drop matrix (closed / running / minimized / multi-file /
> non-image) after moving `.app` to `/Applications`, with `lsregister -f` fallback.
>
> **Escalate before coding:** auto-run vs stage (Q1), race-fix option (Q2), role (Q3),
> breadth of type claim (Q4). Do not expand into signing/notarization or sandbox bookmarks.
> Do NOT commit or push without explicit approval; add a CHANGELOG `[Unreleased]` entry and
> README note when implemented.
