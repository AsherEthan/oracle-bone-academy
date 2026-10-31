import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Glyph } from '../components/Glyph'
import { glyphs, sourcedGlyphs } from './glyphs'
import { canDisplaySource } from './provenance'

const snapshots = {
  止: 'zhi-sinica-page/source.html',
  日: 'primary-check-65e5/page.html',
  月: 'primary-check-6708/page.html',
  水: 'primary-check-6c34/page.html',
} as const
const originals = {
  止: 'zhi-sinica-image/reference.png',
  日: 'primary-image-65e5/reference.png',
  月: 'primary-image-6708/reference.png',
  水: 'primary-image-6c34/reference.png',
} as const

describe('source eligibility and asset integrity, not scholarly authentication', () => {
  it('matches all twelve unchanged PNGs to their recorded hash and downloaded bytes', () => {
    for (const entry of sourcedGlyphs) {
      const source = entry.source!
      const image = readFileSync(new URL(`../../public${source.image}`, import.meta.url))
      expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(createHash('sha256').update(image).digest('hex')).toBe(source.sha256)
      const originalPath = originals[entry.char as keyof typeof originals] ?? `sinica-next-eight-20261031/u${entry.char.codePointAt(0)!.toString(16)}/image/source.png`
      const original = readFileSync(new URL(`../../research/${originalPath}`, import.meta.url))
      expect(image.equals(original)).toBe(true)
      expect(canDisplaySource(source)).toBe(true)
    }
  })
  it('maps each image to the corresponding primary catalogue page, not a modern font image', () => {
    for (const entry of sourcedGlyphs) {
      const source = entry.source!
      const pagePath = snapshots[entry.char as keyof typeof snapshots] ?? `sinica-next-eight-20261031/u${entry.char.codePointAt(0)!.toString(16)}/page/source.html`
      const html = readFileSync(new URL(`../../research/${pagePath}`, import.meta.url), 'utf8')
      const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`alt="&${source.sourceCode};"`))!
      expect(tag).toBeTruthy()
      const modernLabels = [...html.matchAll(/alt="&0\.([0-9a-f]+);"/gi)].map(match => String.fromCodePoint(parseInt(match[1], 16)))
      expect(modernLabels).toContain(entry.char === '鱼' ? '魚' : entry.char)
      const original = new URL(tag.match(/\bsrc="([^"]+)"/)![1], 'https://xiaoxue.iis.sinica.edu.tw')
      original.searchParams.set('size', '300')
      expect(source.originalUrl).toBe(original.href)
      for (const record of source.record.split(' ')) expect(html).toContain(record)
    }
  })
  it('records the actual image license scope', () => {
    const license = readFileSync(new URL('../../research/zhi-sinica-license/license.html', import.meta.url), 'utf8')
    expect(license).toContain('CC0 1.0')
    expect(license).toContain('字形圖片')
    for (const entry of sourcedGlyphs) expect(entry.source?.licensePage).toBe('https://xiaoxue.iis.sinica.edu.tw/License/License')
  })
  it('rejects missing sources, invalid hashes, traversal paths and lookalike domains', () => {
    const source = sourcedGlyphs[0].source!
    expect(canDisplaySource(undefined)).toBe(false)
    expect(canDisplaySource({ ...source, sha256: '' })).toBe(false)
    expect(canDisplaySource({ ...source, image: '/glyph-sources/../made-up.svg' })).toBe(false)
    expect(canDisplaySource({ ...source, sourceRecordUrl: 'https://xiaoxue.iis.sinica.edu.tw.evil.invalid/char' })).toBe(false)
    expect(canDisplaySource({ ...source, originalUrl: 'javascript:alert(1)' })).toBe(false)
    expect(canDisplaySource({ ...source, licensePage: 'not a URL' })).toBe(false)
    expect(canDisplaySource({ ...source, sourceRecordUrl: 'https://xiaoxue.iis.sinica.edu.tw/char?fontcode=41.E000' })).toBe(false)
    expect(canDisplaySource({ ...source, image: '/glyph-sources/sinica-corpus-20261031/glyph-41-e000/image.png' })).toBe(false)
    expect(canDisplaySource({ ...source, sourceCode: '0.6B62' })).toBe(false)
  })
  it('never renders an unverified path, even if legacy data is accidentally supplied', () => {
    const pending = glyphs.find(entry => entry.char === '木')!
    const fake = { ...pending, parts: [{ name: 'invented', paths: ['M59 22 59 92'] }] }
    const html = renderToStaticMarkup(createElement(Glyph, { entry: fake }))
    expect(html).toContain('字形待核对')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<path')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('M59')
  })
  it('uses source images rather than redrawn inline paths for sourced entries', () => {
    const html = renderToStaticMarkup(createElement(Glyph, { entry: sourcedGlyphs[0] }))
    expect(html).toContain('<img')
    expect(html).toContain('非原拓')
    expect(html).not.toContain('<path')
    expect(html).not.toContain('<svg')
  })
  it('does not expose the withdrawn feature modules from the active app', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
    expect(app).not.toMatch(/import .*\b(?:Comparison|Tracing|Quiz)\b/)
    expect(app).not.toContain('entry.parts')
    expect(app).not.toContain('getQuizOptions')
    expect(app).not.toContain('<svg')
  })
})
