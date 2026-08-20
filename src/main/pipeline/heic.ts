import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

const HEIC_RE = /\.(heic|heif)$/i

export interface DecodedSource {
	path: string
	cleanup: () => Promise<void>
}

/**
 * Make a source image readable by Sharp.
 * HEIC/HEIF files are converted to a lossless PNG via macOS `sips`,
 * because Sharp's prebuilt libvips has no HEVC decoder.
 * All other formats pass through untouched.
 *
 * @param filePath - Absolute path to a source image
 * @returns The path Sharp should read, plus a cleanup function for any temp file
 */
export async function toSharpReadablePath(filePath: string): Promise<DecodedSource> {
	if (!HEIC_RE.test(filePath)) {
		return { path: filePath, cleanup: async () => {} }
	}
	const dir = await mkdtemp(join(tmpdir(), 'imageresizer-'))
	const pngPath = join(dir, 'decoded.png')
	try {
		await execFileAsync('sips', ['-s', 'format', 'png', filePath, '--out', pngPath])
	} catch (err) {
		await rm(dir, { recursive: true, force: true }).catch(() => {})
		throw err
	}
	return {
		path: pngPath,
		cleanup: () => rm(dir, { recursive: true, force: true }),
	}
}
