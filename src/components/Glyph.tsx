import { useState } from 'react'
import type { GlyphEntry } from '../data/glyphs'
import { canDisplaySource } from '../data/provenance'

export function Glyph({ entry, className = '', decorative = false }: {
  entry: GlyphEntry
  className?: string
  decorative?: boolean
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const source = canDisplaySource(entry.source) ? entry.source : undefined
  const label = entry.headwordNumber !== undefined ? `字头 ${entry.headwordNumber}` : `字例 ${source?.sourceCode ?? '待核对'}`
  if (!source || source.image === failedImage) {
    return <span className={`glyph-unavailable ${className}`} aria-label={`${label}：${source ? '来源图片暂不可用' : '甲骨字形待核对'}`}><span aria-hidden="true">{source ? '图片暂不可用' : '字形待核对'}</span></span>
  }
  return <img className={`source-glyph ${className}`} src={`${import.meta.env.BASE_URL}${source.image.slice(1)}`} alt={decorative ? '' : `${label}：小學堂${source.sourceCode}，${source.record}字库图，非原拓`} aria-hidden={decorative || undefined} draggable={false} loading="lazy" decoding="async" onError={() => setFailedImage(source.image)} />
}
