import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import corpus from './corpus.json'
import curated from './curated-headwords.json'
import { galleryById, galleryGlyphs, galleryStats, glyphKey, glyphLabel, legacyCollectionIds } from './catalogue'
import { matchesSearch } from './glyphs'
import { canDisplaySource } from './provenance'
import { readCollection } from '../storage'

type RecordRow = { order: number; labels: string[]; examples: { code: string; reference: string; originalUrl: string; sha256: string }[] }
const records = corpus.records as RecordRow[]
const root = new URL('../../', import.meta.url)
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const rangeRowCount = (corpus as typeof corpus & { nativeRangeRows?: number }).nativeRangeRows ?? 0
const nativeRange = rangeRowCount ? json('research/sinica-native-range-20261031/manifest.json') as { complete: boolean; range: number[]; candidateCount: number; absent: number[]; records: { order: number; code: string; folder: string }[] } : undefined

describe('source-native catalogue, not a padded 4,500-character list', () => {
  it('imports the entire acquired directory and supplemental headwords without counting variants as heads', () => {
    const directory = json('research/sinica-corpus-20261031/headwords.json') as { order: number; code: string }[]
    const supplement = json('research/sinica-unlisted-headwords-20261031/manifest.json') as { records: { order: number; code: string }[] }
    expect(corpus.catalogueRows).toBe(2565)
    expect(directory).toHaveLength(corpus.catalogueRows)
    const expectedHeads = new Set([...directory, ...supplement.records, ...(nativeRange?.records ?? []), ...curated].map(record => record.order))
    expect(new Set(galleryGlyphs.map(entry => entry.headwordNumber))).toEqual(expectedHeads)
    expect(galleryStats.headwords).toBe(expectedHeads.size)
    expect(galleryStats.headwords).toBeGreaterThan(2000)
    expect(new Set(galleryGlyphs.map(glyphKey)).size).toBe(galleryGlyphs.length)
    expect(records).toHaveLength(corpus.headwordCount)
    const expectedCodes = new Set([...directory, ...supplement.records, ...(nativeRange?.records ?? [])].map(record => record.code))
    const importedCodes = new Set(records.flatMap(record => record.examples.map(example => example.code)))
    expect(importedCodes).toEqual(expectedCodes)
    expect(galleryStats.withReading).toBe(12)
  })

  it('only publishes native-range records after every candidate has source evidence or a saved empty query', () => {
    if (!nativeRange) {
      expect(rangeRowCount).toBe(0)
      return
    }
    expect(nativeRange.complete).toBe(true)
    expect(nativeRange.range).toEqual([3001, 5952])
    expect(nativeRange.records).toHaveLength(rangeRowCount)
    const directory = json('research/sinica-corpus-20261031/headwords.json') as { order: number }[]
    const supplement = json('research/sinica-unlisted-headwords-20261031/manifest.json') as { records: { order: number }[] }
    const known = new Set([...directory, ...supplement.records].map(record => record.order))
    const expected = Array.from({ length: 5952 - 3001 + 1 }, (_, index) => 3001 + index).filter(order => !known.has(order))
    const checked = [...nativeRange.records.map(record => record.order), ...nativeRange.absent]
    expect(checked.sort((a, b) => a - b)).toEqual(expected)
    expect(nativeRange.candidateCount).toBe(expected.length)
    for (const record of nativeRange.records) {
      expect(record.folder).toBe(`head-${record.order}`)
      const query = readFileSync(new URL(`research/sinica-native-range-20261031/${record.folder}/query/source.html`, root), 'utf8')
      expect(query).toContain(`id="StartOrder">${record.order}</span>`)
      expect(query).toContain(`alt="&${record.code};"`)
      expect(Number(query.match(/共搜尋到(\d+)字/)?.[1])).toBeGreaterThan(0)
    }
    for (const order of nativeRange.absent) {
      const query = readFileSync(new URL(`research/sinica-native-range-20261031/head-${order}/query/source.html`, root), 'utf8')
      expect(query).toContain('共搜尋到0字')
    }
  })

  it('retains source numbers and leaves unmatched readings blank rather than inventing modern characters', () => {
    const unlabelled = galleryGlyphs.filter(entry => !entry.char)
    expect(unlabelled.length).toBeGreaterThan(0)
    for (const entry of galleryGlyphs) {
      expect(entry.id).toBe(`sinica-jgw-${entry.headwordNumber}`)
      expect(entry.source).toBeTruthy()
      expect(entry.examples?.length).toBeGreaterThan(0)
      expect(entry.examples?.every(canDisplaySource)).toBe(true)
      expect(entry.aliases?.every(label => /^\p{Script=Han}$/u.test(label))).toBe(true)
    }
    for (const entry of unlabelled) {
      expect(entry.pinyin).toBe('')
      expect(entry.english).toBe('')
      expect(entry.reading).toBeUndefined()
      expect(entry.aliases).toEqual([])
    }
  })

  it('keeps the original checked images and separates lexical commentary from other examples', () => {
    for (const item of curated) {
      const entry = galleryById.get(`sinica-jgw-${item.order}`)!
      expect(entry.char).toBe(item.char)
      expect(entry.source?.sourceCode).toBe(item.sourceCode)
      expect(entry.reading?.sourceUrl).toMatch(/^https:\/\/humanum\.arts\.cuhk\.edu\.hk\//)
      expect(new Set(entry.examples?.map(example => example.sourceCode)).size).toBe(entry.examples?.length)
    }
    expect(galleryById.get('sinica-jgw-142')?.source?.record).toBe('甲1440 合31080')
  })

  it('supports source labels, native numbers and source example codes', () => {
    const entry = galleryById.get('sinica-jgw-1')!
    for (const query of ['一', '1', '41.E000', '鐵148.1']) expect(matchesSearch(entry, query)).toBe(true)
    expect(matchesSearch(galleryById.get('sinica-jgw-1265')!, 'shui')).toBe(true)
    expect(matchesSearch(galleryById.get('sinica-jgw-1374')!, '魚')).toBe(true)
  })

  it('uses source-native identities rather than modern characters as names and keeps catalogue labels unaltered', () => {
    for (const record of records) {
      const entry = galleryById.get(`sinica-jgw-${record.order}`)!
      expect(glyphLabel(entry)).toBe(`字头 ${record.order}`)
      expect(entry.catalogueLabels).toEqual(record.labels)
    }
    const fish = galleryById.get('sinica-jgw-1374')!
    expect(fish.catalogueLabels).toContain('魚')
    expect(fish.catalogueLabels).not.toContain('鱼')
    expect(matchesSearch(fish, '鱼')).toBe(true)
  })

  it('preserves and deduplicates old bookmarks while allowing unlabelled source-native IDs', () => {
    const unlabelled = galleryGlyphs.find(entry => !entry.char)!
    const wood = legacyCollectionIds.get('木')!
    expect(galleryById.has(wood)).toBe(true)
    expect(readCollection({ getItem: () => JSON.stringify(['日', '木', 'sinica-jgw-806', unlabelled.id, unlabelled.id, 'invalid']) })).toEqual(['sinica-jgw-806', wood, unlabelled.id])
  })

  it('matches every imported PNG, source code, reference and modern label to saved primary evidence', () => {
    const supplemental = json('research/sinica-unlisted-headwords-20261031/manifest.json') as { records: { code: string; folder: string }[] }
    const extraByCode = new Map([
      ...supplemental.records.map(record => [record.code, `research/sinica-unlisted-headwords-20261031/${record.folder}`] as const),
      ...(nativeRange?.records ?? []).map(record => [record.code, `research/sinica-native-range-20261031/${record.folder}`] as const),
    ])
    for (const record of records) {
      const expectedLabels = new Set<string>()
      for (const example of record.examples) {
        const folder = `glyph-${example.code.toLowerCase().replace('.', '-')}`
        let sourceFolder = `research/sinica-corpus-20261031/${folder}`
        if (extraByCode.has(example.code)) sourceFolder = extraByCode.get(example.code)!
        const html = readFileSync(new URL(`${sourceFolder}/page/source.html`, root), 'utf8')
        for (const match of html.matchAll(/alt="&0\.([0-9a-f]+);"/gi)) {
          const label = String.fromCodePoint(parseInt(match[1], 16))
          if (/^\p{Script=Han}$/u.test(label)) expectedLabels.add(label)
        }
        const original = readFileSync(new URL(`${sourceFolder}/image/source.png`, root))
        const asset = readFileSync(new URL(`public/glyph-sources/sinica-corpus-20261031/${folder}/image.png`, root))
        expect(asset.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
        expect(createHash('sha256').update(asset).digest('hex')).toBe(example.sha256)
        expect(asset.equals(original)).toBe(true)
        expect(html).toContain(`alt="&${example.code};"`)
        const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`alt="&${example.code};"`))!
        const url = new URL(tag.match(/\bsrc="([^"]+)"/)![1], 'https://xiaoxue.iis.sinica.edu.tw')
        url.searchParams.set('size', '200')
        expect(example.originalUrl).toBe(url.href)
        expect(example.reference).not.toMatch(/<[^>]+>/)
        const sourceReference = html.match(/<span id="Reference">([\s\S]*?)<\/span>/)![1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        expect(example.reference).toBe(sourceReference)
      }
      expect(new Set(record.labels)).toEqual(expectedLabels)
    }
  }, 60000)
})
