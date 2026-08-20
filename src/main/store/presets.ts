import ElectronStore from "electron-store";
import {
	type Preset,
	DEFAULT_PRESETS,
	derivePresetName,
} from "../../shared/preset";

interface StoreSchema {
	version: number;
	presets: Preset[];
}

const store = new ElectronStore<StoreSchema>({
	name: "presets",
	defaults: {
		version: 3,
		presets: [],
	},
});

/** Map format to its clean display name */
function cleanName(format: string): string {
	switch (format) {
		case "png":
			return "PNG";
		case "webp":
			return "WebP";
		case "jpeg":
			return "JPEG";
		case "avif":
			return "AVIF";
		default:
			return format.toUpperCase();
	}
}

/** Legacy default preset names, normalized to clean names on load */
const OLD_DEFAULT_NAMES = new Set(["PNG 4-color 1200", "WebP 70 1200"]);

/**
 * Load presets from disk. Seeds defaults on first run (empty store).
 * Normalizes legacy auto-derived preset names to clean names on every load.
 * Idempotent: clean names never match the legacy patterns, so re-running is safe.
 * @returns Preset[]
 */
export function loadPresets(): Preset[] {
	const saved = store.get("presets");
	if (!saved || saved.length === 0) {
		store.set("presets", DEFAULT_PRESETS);
		store.set("version", 3);
		return DEFAULT_PRESETS;
	}
	// Normalize on every load rather than gating on a version number: older
	// stores may lack a persisted version key, in which case electron-store
	// returns the default (3) and the rename would be silently skipped.
	const migrated = saved.map((p) => {
		if (OLD_DEFAULT_NAMES.has(p.name) || p.name === derivePresetName(p)) {
			return { ...p, name: cleanName(p.format) };
		}
		return p;
	});
	if (migrated.some((p, i) => p.name !== saved[i].name)) {
		store.set("presets", migrated);
	}
	store.set("version", 3);
	return migrated;
}

/**
 * Persist presets to disk.
 * @param presets - Array of presets to save
 */
export function savePresets(presets: Preset[]): void {
	store.set("presets", presets);
}
