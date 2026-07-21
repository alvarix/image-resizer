export type OutputFormat = "png" | "webp" | "jpeg" | "avif";

export interface Preset {
	id: string;
	name: string;
	maxLongestSide: number;
	format: OutputFormat;
	/** 2-256, only valid when format === 'png' */
	pngColors?: number;
	/** 1-100, only valid when format is webp | jpeg | avif */
	quality?: number;
	enabled: boolean;
}

export interface RunEntry {
	id: string;
	timestamp: number;
	files: number;
	presets: number;
	outputs: number;
	errors: number;
	/** Names of the presets used in this run */
	presetNames?: string[];
}

export type ProgressEvent =
	| { type: "start"; total: number }
	| {
			type: "item";
			file: string;
			preset: string;
			status: "ok" | "error";
			error?: string;
			outPath?: string;
	  }
	| { type: "done" };

export interface DefaultSettings {
	maxLongestSide: number;
	pngColors: number;
	quality: number;
}

export const DEFAULT_SETTINGS: DefaultSettings = {
	maxLongestSide: 1200,
	pngColors: 4,
	quality: 80,
};

export const DEFAULT_PRESETS: Preset[] = [
	{
		id: "default-png",
		name: "PNG 4-color 1200",
		maxLongestSide: 1200,
		format: "png",
		pngColors: 4,
		enabled: true,
	},
	{
		id: "default-webp",
		name: "WebP 70 1200",
		maxLongestSide: 1200,
		format: "webp",
		quality: 70,
		enabled: true,
	},
];

/**
 * Derive a descriptive name from preset settings.
 * Format: "{FORMAT} q{quality} {size}" or "PNG {colors}c {size}"
 * @param preset - The preset to derive a name for
 * @returns A human-readable name reflecting current settings
 */
export function derivePresetName(preset: Preset): string {
	const fmt = preset.format.toUpperCase();
	if (preset.format === "png") {
		return `${fmt} ${preset.pngColors ?? 4}c ${preset.maxLongestSide}`;
	}
	return `${fmt} q${preset.quality ?? 80} ${preset.maxLongestSide}`;
}

/** Canonical list of supported image extensions */
export const SUPPORTED_EXTENSIONS: string[] = [
	"png",
	"jpg",
	"jpeg",
	"webp",
	"avif",
	"heic",
	"heif",
	"tif",
	"tiff",
	"gif",
];

/** Regex matching supported image file extensions (case-insensitive) */
/** Derive the output file extension from a preset's format.
 * JPEG outputs use .jpg for consistency. */
export function outputExtension(preset: Preset): string {
	return preset.format === "jpeg" ? "jpg" : preset.format;
}

/** Regex matching supported image file extensions (case-insensitive) */
export const SUPPORTED_EXTENSIONS_RE =
	/\.(png|jpe?g|webp|avif|heic|heif|tiff?|gif)$/i;
