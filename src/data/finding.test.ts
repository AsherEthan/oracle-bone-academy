import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { galleryById, galleryGlyphs } from './catalogue'
import { findGlyphs, imageShape, searchMatch } from './finding'
import visualIndex from './visual-index.json'

const root = new URL('../../', import.meta.url)

describe('finding source examples without defining ancient characters', () => {
  it('ranks exact headword numbers ahead of incidental inscription numbers', () => {
    expect(findGlyphs(galleryGlyphs, '142')[0].headwordNumber).toBe(142)
    expect(findGlyphs(galleryGlyphs, '字头 142')[0].headwordNumber).toBe(142)
    expect(findGlyphs(galleryGlyphs, '#142')[0].headwordNumber).toBe(142)
  })
  it('accepts pasted source codes and points at the matching example rather than the default image', () => {
    const entry = galleryById.get('sinica-jgw-142')!
    const other = entry.examples!.find(source => source.sourceCode !== entry.source!.sourceCode)!
    expect(other).toBeTruthy()
    expect(searchMatch(entry, other.sourceCode)?.sourceCode).toBe(other.sourceCode)
    for (const query of ['45.E538', '45 e538', '45-e538']) {
      const first = findGlyphs(galleryGlyphs, query)[0]
      expect(first.headwordNumber).toBe(3500)
      expect(searchMatch(first, query)?.sourceCode).toBe('45.E538')
    }
  })
  it('puts exact source labels ahead of mentions in reference materials', () => {
    const results = findGlyphs(galleryGlyphs, '人')
    expect(results[0].catalogueLabels).toContain('人')
    expect(searchMatch(results[0], '人')?.reason).toBe('匹配来源目录标签')
    expect(findGlyphs(galleryGlyphs, 'shui')[0].headwordNumber).toBe(1265)
    expect(findGlyphs(galleryGlyphs, '不存在的字XYZ')).toEqual([])
    expect(findGlyphs(galleryGlyphs, '  ')).toBe(galleryGlyphs)
  })
  it('finds reference numbers without treating the reference material citation as the displayed inscription', () => {
    const entry = galleryById.get('sinica-jgw-142')!
    expect(searchMatch(entry, '合 31080')?.sourceCode).toBe('41.E74A')
    expect(searchMatch(entry, '13688')?.reason).not.toBe('著录 · 甲1440 合31080')
  })
  it('binds every visual measurement to the actual primary source code and current source inputs', () => {
    const digest = createHash('sha256')
    for (const name of ['corpus.json', 'source-manifest.json', 'curated-headwords.json']) digest.update(readFileSync(new URL(`src/data/${name}`, root)))
    expect(digest.digest('hex')).toBe(visualIndex.inputDigest)
    expect(visualIndex.threshold).toBe(160)
    expect(Object.keys(visualIndex.records)).toHaveLength(galleryGlyphs.length)
    const metrics = visualIndex.records as Record<string, (string | number)[]>
    for (const entry of galleryGlyphs) {
      const metric = metrics[String(entry.headwordNumber)]
      expect(metric[0]).toBe(entry.source!.sourceCode)
      const png = readFileSync(new URL(`public${entry.source!.image}`, root))
      expect(Number(metric[1])).toBeGreaterThan(0)
      expect(Number(metric[2])).toBeGreaterThan(0)
      expect(Number(metric[1])).toBeLessThanOrEqual(png.readUInt32BE(16))
      expect(Number(metric[2])).toBeLessThanOrEqual(png.readUInt32BE(20))
      expect(['tall', 'wide', 'square']).toContain(imageShape(entry))
    }
  }, 60000)
  it('uses only image proportions, and declines a measurement if its source code does not match', () => {
    const groups = ['tall', 'wide', 'square'].map(shape => galleryGlyphs.filter(entry => imageShape(entry) === shape))
    expect(groups.every(group => group.length > 0)).toBe(true)
    expect(groups.flat()).toHaveLength(galleryGlyphs.length)
    const entry = galleryGlyphs[0]
    expect(imageShape({ ...entry, source: { ...entry.source!, sourceCode: '41.E000' } })).toBeUndefined()
  })
})
