import { describe, it, expect } from "vitest";
import {
	SUPPORTED_EXTENSIONS,
	SUPPORTED_EXTENSIONS_RE,
	derivePresetName,
	outputExtension,
	type Preset,
} from "./preset";

describe("SUPPORTED_EXTENSIONS", () => {
	it("contains all canonical image extensions", () => {
		const expected = [
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
		for (const ext of expected) {
			expect(SUPPORTED_EXTENSIONS).toContain(ext);
		}
	});

	it("has no duplicate entries", () => {
		const lower = SUPPORTED_EXTENSIONS.map((e) => e.toLowerCase());
		expect(lower.length).toBe(new Set(lower).size);
	});

	it("has exactly 10 entries to prevent accidental drift", () => {
		expect(SUPPORTED_EXTENSIONS).toHaveLength(10);
	});
});

describe("SUPPORTED_EXTENSIONS_RE", () => {
	it.each([
		"photo.png",
		"image.JPG",
		"test.JPEG",
		"screen.webp",
		"pic.avif",
		"img.HEIC",
		"img.HEIF",
		"scan.tif",
		"scan.TIFF",
		"anim.gif",
	])("matches %s", (path) => {
		expect(SUPPORTED_EXTENSIONS_RE.test(path)).toBe(true);
	});

	it("matches paths with full directory names", () => {
		expect(
			SUPPORTED_EXTENSIONS_RE.test("/Users/me/Pictures/holiday/photo.png"),
		).toBe(true);
	});

	it.each([
		"notes.txt",
		"document.pdf",
		"spreadsheet.csv",
		"photo",
		"",
		"imagepng",
		"script.js",
		"readme.md",
	])("rejects %s", (path) => {
		expect(SUPPORTED_EXTENSIONS_RE.test(path)).toBe(false);
	});
});

describe("extension list consistency", () => {
	it("every extension in the array is covered by the regex", () => {
		for (const ext of SUPPORTED_EXTENSIONS) {
			expect(SUPPORTED_EXTENSIONS_RE.test(`test.${ext}`)).toBe(true);
		}
	});
});

describe("derivePresetName", () => {
	it("generates name for PNG format with colors and size", () => {
		const p: Preset = {
			id: "1",
			name: "",
			maxLongestSide: 1200,
			format: "png",
			pngColors: 4,
			enabled: true,
		};
		expect(derivePresetName(p)).toBe("PNG 4c 1200");
	});

	it("generates name for PNG with default colors when pngColors is undefined", () => {
		const p: Preset = {
			id: "2",
			name: "",
			maxLongestSide: 800,
			format: "png",
			enabled: true,
		};
		expect(derivePresetName(p)).toBe("PNG 4c 800");
	});

	it("generates name for WebP format with quality and size", () => {
		const p: Preset = {
			id: "3",
			name: "",
			maxLongestSide: 1200,
			format: "webp",
			quality: 80,
			enabled: true,
		};
		expect(derivePresetName(p)).toBe("WEBP q80 1200");
	});

	it("generates name for JPEG format with default quality", () => {
		const p: Preset = {
			id: "4",
			name: "",
			maxLongestSide: 640,
			format: "jpeg",
			enabled: true,
		};
		expect(derivePresetName(p)).toBe("JPEG q80 640");
	});

	it("generates name for AVIF format", () => {
		const p: Preset = {
			id: "5",
			name: "",
			maxLongestSide: 1920,
			format: "avif",
			quality: 50,
			enabled: true,
		};
		expect(derivePresetName(p)).toBe("AVIF q50 1920");
	});
});

describe("outputExtension", () => {
	it("returns png for PNG preset", () => {
		const p: Preset = {
			id: "1",
			name: "",
			maxLongestSide: 1200,
			format: "png",
			enabled: true,
		};
		expect(outputExtension(p)).toBe("png");
	});

	it("returns webp for WebP preset", () => {
		const p: Preset = {
			id: "2",
			name: "",
			maxLongestSide: 1200,
			format: "webp",
			enabled: true,
		};
		expect(outputExtension(p)).toBe("webp");
	});

	it("returns jpg for JPEG preset (not jpeg)", () => {
		const p: Preset = {
			id: "3",
			name: "",
			maxLongestSide: 1200,
			format: "jpeg",
			enabled: true,
		};
		expect(outputExtension(p)).toBe("jpg");
	});

	it("returns avif for AVIF preset", () => {
		const p: Preset = {
			id: "4",
			name: "",
			maxLongestSide: 1200,
			format: "avif",
			enabled: true,
		};
		expect(outputExtension(p)).toBe("avif");
	});
});
