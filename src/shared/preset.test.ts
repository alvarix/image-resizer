import { describe, it, expect } from 'vitest'
import { SUPPORTED_EXTENSIONS, SUPPORTED_EXTENSIONS_RE } from './preset'

describe('SUPPORTED_EXTENSIONS', () => {
  it('contains all canonical image extensions', () => {
    const expected = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'gif']
    for (const ext of expected) {
      expect(SUPPORTED_EXTENSIONS).toContain(ext)
    }
  })

  it('has no duplicate entries', () => {
    const lower = SUPPORTED_EXTENSIONS.map((e) => e.toLowerCase())
    expect(lower.length).toBe(new Set(lower).size)
  })

  it('has exactly 10 entries to prevent accidental drift', () => {
    expect(SUPPORTED_EXTENSIONS).toHaveLength(10)
  })
})

describe('SUPPORTED_EXTENSIONS_RE', () => {
  it.each([
    'photo.png',
    'image.JPG',
    'test.JPEG',
    'screen.webp',
    'pic.avif',
    'img.HEIC',
    'img.HEIF',
    'scan.tif',
    'scan.TIFF',
    'anim.gif'
  ])('matches %s', (path) => {
    expect(SUPPORTED_EXTENSIONS_RE.test(path)).toBe(true)
  })

  it('matches paths with full directory names', () => {
    expect(SUPPORTED_EXTENSIONS_RE.test('/Users/me/Pictures/holiday/photo.png')).toBe(true)
  })

  it.each([
    'notes.txt',
    'document.pdf',
    'spreadsheet.csv',
    'photo',
    '',
    'imagepng',
    'script.js',
    'readme.md'
  ])('rejects %s', (path) => {
    expect(SUPPORTED_EXTENSIONS_RE.test(path)).toBe(false)
  })
})

describe('extension list consistency', () => {
  it('every extension in the array is covered by the regex', () => {
    for (const ext of SUPPORTED_EXTENSIONS) {
      expect(SUPPORTED_EXTENSIONS_RE.test(`test.${ext}`)).toBe(true)
    }
  })
})
