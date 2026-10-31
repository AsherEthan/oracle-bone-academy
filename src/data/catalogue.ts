import corpus from './corpus.json'
import curatedHeadwords from './curated-headwords.json'
import { glyphs, sourcedGlyphs, traditionalForms, type GlyphEntry } from './glyphs'
import { canDisplaySource, type GlyphSource } from './provenance'

type CorpusRecord = {
  order: number
  labels: string[]
  examples: { code: string; reference: string; originalUrl: string; sha256: string }[]
}

function toSource(example: CorpusRecord['examples'][number]): GlyphSource {
  const page = `https://xiaoxue.iis.sinica.edu.tw/char?fontcode=${example.code}`
  return {
    status: 'source-record-checked',
    kind: 'catalogue-image',
    image: `/glyph-sources/sinica-corpus-20261031/glyph-${example.code.toLowerCase().replace('.', '-')}/image.png`,
    fileTitle: `小學堂 ${example.code}`,
    filePage: page,
    originalUrl: example.originalUrl,
    sourceRecordUrl: page,
    sourceCode: example.code,
    record: example.reference,
    license: 'CC0 1.0（小學堂查询所得字形图片）',
    licensePage: 'https://xiaoxue.iis.sinica.edu.tw/License/License',
    credit: '中央研究院小學堂文字學資料庫。保持查询图片原样，未重新描画。',
    sha256: example.sha256,
    checkedAt: corpus.checkedAt,
  }
}

const modernByLabel = new Map(glyphs.flatMap(entry =>
  [entry.char, traditionalForms[entry.char]].filter(Boolean).map(label => [label, entry] as const),
))
const entries = new Map<number, GlyphEntry>()
for (const record of corpus.records as CorpusRecord[]) {
  const examples = record.examples.map(toSource)
  if (!examples.length || examples.some(source => !canDisplaySource(source))) throw new Error(`Invalid source record ${record.order}`)
  const modern = record.labels.map(label => modernByLabel.get(label)).find(Boolean)
  entries.set(record.order, {
    id: `sinica-jgw-${record.order}`,
    headwordNumber: record.order,
    char: modern?.char ?? record.labels[0] ?? '',
    aliases: record.labels,
    catalogueLabels: record.labels,
    pinyin: modern?.pinyin ?? '',
    english: modern?.english ?? '',
    category: modern?.category,
    source: examples[0],
    examples,
  })
}

// Preserve the separately checked images and reference pointers; never add a second
// card just because this exhibition uses a different example of the same headword.
const curated: GlyphEntry[] = sourcedGlyphs.map(entry => {
  const mapping = curatedHeadwords.find(item => item.char === entry.char && item.sourceCode === entry.source?.sourceCode)
  if (!mapping) throw new Error(`Missing curated headword identity: ${entry.char}`)
  const imported = entries.get(mapping.order)
  const enriched = {
    ...entry,
    id: `sinica-jgw-${mapping.order}`,
    headwordNumber: mapping.order,
    aliases: [...new Set([entry.char, traditionalForms[entry.char], ...(imported?.aliases ?? [])].filter(Boolean))],
    catalogueLabels: imported?.catalogueLabels ?? [],
    examples: [entry.source!, ...(imported?.examples ?? []).filter(source => source.sourceCode !== entry.source?.sourceCode)],
  }
  entries.delete(mapping.order)
  return enriched
})

export const galleryGlyphs = [...curated, ...entries.values()]
export const galleryById = new Map(galleryGlyphs.map(entry => [entry.id!, entry]))
export const galleryStats = {
  headwords: galleryGlyphs.length,
  examples: new Set(galleryGlyphs.flatMap(entry => (entry.examples ?? []).map(source => source.sourceCode))).size,
  labelled: galleryGlyphs.filter(entry => !!entry.char).length,
  withReading: galleryGlyphs.filter(entry => !!entry.reading).length,
  sourceCatalogueRows: corpus.catalogueRows,
}
export const legacyCollectionIds = new Map(glyphs.map(entry => {
  const match = galleryGlyphs.find(item => item.char === entry.char || item.aliases?.includes(entry.char))
  return [entry.char, match?.id ?? entry.char] as const
}))
export function glyphLabel(entry: GlyphEntry) {
  return entry.headwordNumber !== undefined ? `字头 ${entry.headwordNumber}` : `字例 ${entry.source?.sourceCode ?? '待核对'}`
}
export function glyphKey(entry: GlyphEntry) {
  return entry.id ?? entry.char
}
