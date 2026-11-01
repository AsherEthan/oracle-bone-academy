import visualIndex from './visual-index.json'
import { matchesSearch, normalizeSearch, type GlyphEntry } from './glyphs'

export const shapeFilters = [
  { id: 'all', name: '不限轮廓' },
  { id: 'tall', name: '偏高' },
  { id: 'wide', name: '偏宽' },
  { id: 'square', name: '近方' },
] as const
export type ShapeFilter = typeof shapeFilters[number]['id']
export type SearchMatch = { rank: number; reason: string; sourceCode?: string }
const metrics = visualIndex.records as Record<string, (string | number)[]>

export function imageShape(entry: GlyphEntry): Exclude<ShapeFilter, 'all'> | undefined {
  const metric = metrics[String(entry.headwordNumber)]
  if (!metric || metric[0] !== entry.source?.sourceCode) return undefined
  const ratio = Number(metric[1]) / Number(metric[2])
  return ratio > 1.25 ? 'wide' : ratio < 0.8 ? 'tall' : 'square'
}

export function searchMatch(entry: GlyphEntry, query: string): SearchMatch | undefined {
  const raw = query.trim()
  if (!raw) return undefined
  const code = raw.match(/^(4[1-9])[\s.·-]+([a-f0-9]+)$/i)
  const needle = normalizeSearch(code ? `${code[1]}.${code[2]}` : raw)
  const number = normalizeSearch(raw.replace(/^(?:字头|字頭|#)\s*/, ''))
  if (String(entry.headwordNumber) === number) return { rank: 0, reason: '字头号完全匹配' }
  const examples = entry.examples ?? (entry.source ? [entry.source] : [])
  const exactExample = examples.find(source => normalizeSearch(source.sourceCode) === needle)
  if (exactExample) return { rank: 0, reason: `字例号 · ${exactExample.sourceCode}`, sourceCode: exactExample.sourceCode }
  if (entry.catalogueLabels?.some(label => normalizeSearch(label) === needle)) return { rank: 1, reason: '匹配来源目录标签' }
  if ([entry.char, ...(entry.aliases ?? [])].some(label => normalizeSearch(label) === needle)) return { rank: 2, reason: '匹配现代检索别名' }
  if (entry.pinyin && normalizeSearch(entry.pinyin) === needle) return { rank: 2, reason: '匹配现代拼音检索词' }
  const reference = examples.find(source => normalizeSearch(source.record).includes(needle))
  if (reference) return { rank: 3, reason: `著录 · ${reference.record}`, sourceCode: reference.sourceCode }
  const partialExample = examples.find(source => normalizeSearch(source.sourceCode).includes(needle))
  if (partialExample) return { rank: 4, reason: `字例号 · ${partialExample.sourceCode}`, sourceCode: partialExample.sourceCode }
  if (!matchesSearch(entry, raw)) return undefined
  const reading = normalizeSearch(`${entry.reading?.description ?? ''}${entry.reading?.sourceTitle ?? ''}`)
  return { rank: 5, reason: reading.includes(needle) ? '匹配参考材料' : '匹配现代检索词' }
}

export function findGlyphs(entries: GlyphEntry[], query: string) {
  if (!query.trim()) return entries
  return entries.map(entry => ({ entry, match: searchMatch(entry, query) }))
    .filter(item => item.match !== undefined)
    .sort((a, b) => a.match!.rank - b.match!.rank)
    .map(item => item.entry)
}
