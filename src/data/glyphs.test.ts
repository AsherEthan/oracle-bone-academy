import { describe, expect, it } from 'vitest'
import { categories, glyphs, matchesSearch, normalizeSearch, pendingGlyphs, sourcedGlyphs } from './glyphs'
import { readCollection, COLLECTION_KEY } from '../storage'
import { legacyCollectionIds } from './catalogue'

const get = (char: string) => glyphs.find(entry => entry.char === char)!

describe('modern lookup index, separate from historical examples', () => {
  it('retains 120 unique lookup labels across six categories', () => {
    expect(glyphs).toHaveLength(120)
    expect(new Set(glyphs.map(entry => entry.char)).size).toBe(120)
    expect(categories).toHaveLength(6)
    for (const entry of glyphs) {
      expect(categories.some(category => category.id === entry.category)).toBe(true)
      expect(entry.pinyin).toBeTruthy()
      expect(entry).not.toHaveProperty('parts')
      expect(entry).not.toHaveProperty('paths')
      expect(entry).not.toHaveProperty('observation')
      expect(entry).not.toHaveProperty('meaning')
    }
  })
  it('distinguishes twelve sourced images from 108 pending labels', () => {
    expect(sourcedGlyphs.map(entry => entry.char).sort()).toEqual(['日', '月', '水', '火', '雨', '人', '子', '目', '口', '止', '牛', '鱼'].sort())
    expect(pendingGlyphs).toHaveLength(108)
    for (const entry of pendingGlyphs) {
      expect(entry.source).toBeUndefined()
      expect(entry.reading).toBeUndefined()
    }
  })
  it('supports modern lookup terms and reference-material topics', () => {
    for (const query of ['日', 'ri', 'rì', '太阳', '   ']) expect(matchesSearch(get('日'), query)).toBe(true)
    expect(matchesSearch(get('日'), '不存在')).toBe(false)
    expect(normalizeSearch(' Nǚ ')).toBe('nu')
  })
  it('retains traditional and alternate modern search labels', () => {
    for (const [char, query] of [['风', '風'], ['见', '見'], ['东', '東'], ['艸', '草'], ['冰', '仌'], ['见', 'jian']]) {
      expect(matchesSearch(get(char), query)).toBe(true)
    }
  })
  it('keeps lexical references distinct from the displayed inscription record', () => {
    expect(get('止').source?.sourceCode).toBe('41.E74A')
    expect(get('止').source?.record).toBe('甲1440 合31080')
    expect(get('止').reading?.evidence).toContain('13688')
    expect(get('止').reading?.evidence).toContain('不是本页摹本')
    expect(get('月').source?.record).toBe('簠天1 合33694')
    expect(get('月').source?.record).not.toContain('歷組')
    for (const entry of sourcedGlyphs) {
      expect(entry.reading?.description).toBeTruthy()
      expect(entry.reading).not.toHaveProperty('caption')
      expect(entry.reading).not.toHaveProperty('summary')
      expect(entry.reading).not.toHaveProperty('look')
      expect(entry.reading?.sourceUrl).toMatch(/^https:\/\/humanum\.arts\.cuhk\.edu\.hk\/Lexis\/lexi-mf\/search\.php\?word=/)
      expect(entry.source?.sourceRecordUrl).toContain('xiaoxue.iis.sinica.edu.tw/char?fontcode=')
    }
  })
})

describe('private local collection', () => {
  it('preserves sourced and pending selections without changing the storage key', () => {
    expect(COLLECTION_KEY).toBe('zizai.collection.v1')
    expect(readCollection({ getItem: () => '["日","木","止","木","not a glyph",4,null]' })).toEqual(['日', '木', '止'].map(char => legacyCollectionIds.get(char)))
  })
  it('recovers from invalid, blocked or unavailable storage', () => {
    expect(readCollection({ getItem: () => '{bad' })).toEqual([])
    expect(readCollection({ getItem: () => '{}' })).toEqual([])
    expect(readCollection({ getItem: () => { throw new Error('blocked') } })).toEqual([])
    expect(readCollection(undefined)).toEqual([])
  })
})
