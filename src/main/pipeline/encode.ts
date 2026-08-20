import sharp from 'sharp'
import type { ResizeOptions } from 'sharp'
import type { Preset } from '../../shared/preset'
import { toSharpReadablePath } from './heic'

/**
 * Resize and encode a single source image according to the preset.
 * Always strips EXIF (Sharp default); .rotate() bakes in orientation first.
 * HEIC/HEIF sources are pre-decoded to PNG via macOS `sips` (see heic.ts).
 *
 * @param srcPath - Absolute path to the source image
 * @param outPath - Absolute path for the output file
 * @param preset - Preset describing format and quality settings
 */
export async function encode(srcPath: string, outPath: string, preset: Preset): Promise<void> {
  const src = await toSharpReadablePath(srcPath)
  try {
    const max = preset.maxLongestSide
    const resizeOpts: ResizeOptions = {
      width: max,
      height: max,
      fit: 'inside',
      withoutEnlargement: true
    }

    const base = sharp(src.path).rotate().resize(resizeOpts)

    switch (preset.format) {
      case 'png':
        await base
          .png({ palette: true, colours: preset.pngColors ?? 4, compressionLevel: 9 })
          .toFile(outPath)
        break

      case 'webp':
        await base
          .webp({ quality: preset.quality ?? 80 })
          .toFile(outPath)
        break

      case 'jpeg':
        await base
          .jpeg({ quality: preset.quality ?? 80, mozjpeg: true })
          .toFile(outPath)
        break

      case 'avif':
        await base
          .avif({ quality: preset.quality ?? 80 })
          .toFile(outPath)
        break

      default:
        throw new Error(`Unknown format: ${(preset as { format: string }).format}`)
    }
  } finally {
    await src.cleanup()
  }
}
