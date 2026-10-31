export type GlyphSource = {
  status: 'source-record-checked'
  kind: 'catalogue-image'
  image: string
  fileTitle: string
  filePage: string
  originalUrl: string
  sourceRecordUrl: string
  sourceCode: string
  record: string
  license: string
  licensePage: string
  credit: string
  sha256: string
  checkedAt: string
}

export type ReadingNote = {
  description: string
  sourceTitle: string
  sourceUrl: string
  evidence: string
  checkedAt: string
}

function isCatalogueUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'xiaoxue.iis.sinica.edu.tw' && !url.username && !url.password
  } catch {
    return false
  }
}

// This checks display eligibility, not the scholarly correctness of a glyph.
export function canDisplaySource(source: GlyphSource | undefined): source is GlyphSource {
  return !!source && source.status === 'source-record-checked' && source.kind === 'catalogue-image'
    && /^\/glyph-sources\/(?:sinica-\d{8}\/u[a-f0-9]+|sinica-corpus-\d{8}\/glyph-4[1-9]-[a-f0-9]+)\/image\.png$/.test(source.image)
    && /^[a-f0-9]{64}$/.test(source.sha256)
    && /^4[1-9]\.[A-F0-9]+$/.test(source.sourceCode)
    && isCatalogueUrl(source.sourceRecordUrl) && isCatalogueUrl(source.originalUrl)
    && new URL(source.sourceRecordUrl).searchParams.get('fontcode') === source.sourceCode
    && (!source.image.includes('/sinica-corpus-') || source.image.endsWith(`/glyph-${source.sourceCode.toLowerCase().replace('.', '-')}/image.png`))
    && isCatalogueUrl(source.licensePage)
    && !!source.sourceCode && !!source.record && !!source.license
}
