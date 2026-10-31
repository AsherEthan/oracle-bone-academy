import modernIndex from './modern-index.json'
import sourceManifest from './source-manifest.json'
import { canDisplaySource, type GlyphSource, type ReadingNote } from './provenance'

export type CategoryId = 'nature' | 'plants' | 'animals' | 'human' | 'objects' | 'direction'
export type GlyphEntry = {
  id?: string
  headwordNumber?: number
  aliases?: string[]
  catalogueLabels?: string[]
  examples?: GlyphSource[]
  char: string
  pinyin: string
  english: string
  category?: CategoryId
  source?: GlyphSource
  reading?: ReadingNote
}

export const categories: { id: CategoryId; name: string; subtitle: string }[] = [
  { id: 'nature', name: '天地自然', subtitle: '日月、流水与雨火' },
  { id: 'plants', name: '草木生长', subtitle: '树木与草叶' },
  { id: 'animals', name: '飞鸟走兽', subtitle: '身边的动物' },
  { id: 'human', name: '人与身体', subtitle: '人的身影与身体' },
  { id: 'objects', name: '器物日常', subtitle: '生活里的器物' },
  { id: 'direction', name: '数与方位', subtitle: '数量与方向' },
]

const readingNotes: Record<string, ReadingNote> = {
  止: {
    description: '可参阅该字条对足部用义、相关字形及借用关系的讨论。',
    sourceTitle: '漢語多功能字庫 · 止',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E6%AD%A2',
    evidence: '该页以《合集》13688的「疾止」说明足部用义。这是释义所引辞例，不是本页摹本「合31080」的配辞。',
    checkedAt: '2026-10-31',
  },
  日: {
    description: '可参阅该字条对太阳取象说、不同字形及卜辞用例的讨论。',
    sourceTitle: '漢語多功能字庫 · 日',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E6%97%A5',
    evidence: '该页列有《合集》34163、11480等辞例；这些例号未与本站选用的「合5216」摹本配对，不据此拼接原辞。',
    checkedAt: '2026-10-31',
  },
  月: {
    description: '可参阅该字条对月亮形象、月份用法及相关引辞的讨论。',
    sourceTitle: '漢語多功能字庫 · 月',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E6%9C%88',
    evidence: '该页列有《合集》11483正、5658正；并未明确将这些辞例与本站选用的「合33694」摹本配对。',
    checkedAt: '2026-10-31',
  },
  水: {
    description: '可参阅该字条对流水取象说、点画差异及卜辞用例的讨论。',
    sourceTitle: '漢語多功能字庫 · 水',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E6%B0%B4',
    evidence: '该页列有《合集》10150、14407、23532等辞例；不据此推定本站「合34165」摹本所在原辞。',
    checkedAt: '2026-10-31',
  },
  火: {
    description: '可参阅该字条对火焰取象说、与其他形体的辨别及上下文的讨论。',
    sourceTitle: '漢語多功能字庫 · 火',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E7%81%AB',
    evidence: '字库列有《合集》30774、11503、34797等用例，并未将它们配给本站「合17067」这幅字例。',
    checkedAt: '2026-10-31',
  },
  雨: {
    description: '可参阅该字条对雨滴取象说、形体差异及相关引辞的讨论。',
    sourceTitle: '漢語多功能字庫 · 雨',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E9%9B%A8',
    evidence: '字库列有《合集》8329、20397、9757、12598等用例；它们不是本站所用「佚55」图片的出处。',
    checkedAt: '2026-10-31',
  },
  人: {
    description: '可参阅该字条对侧身人形解释及相关字形、辞例的讨论。',
    sourceTitle: '漢語多功能字庫 · 人',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E4%BA%BA',
    evidence: '字库列有《合集》22626、20328及《英》2524等用例，不据此拼造本站「合18901」所在原辞。',
    checkedAt: '2026-10-31',
  },
  子: {
    description: '可参阅该字条对婴儿取象说、多种形体及称谓用法的讨论。',
    sourceTitle: '漢語多功能字庫 · 子',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E5%AD%90',
    evidence: '字库讨论多种早期形体及用法；本站只展示「乙6702」所对应的字库图，不将其他引辞与它配对。',
    checkedAt: '2026-10-31',
  },
  目: {
    description: '可参阅该字条对眼睛取象说及相关形体的讨论。',
    sourceTitle: '漢語多功能字庫 · 目',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E7%9B%AE',
    evidence: '释义概述依据字库对目形的讨论，不是对「合11654」所在卜辞的释文；字形方向保持来源原样。',
    checkedAt: '2026-10-31',
  },
  口: {
    description: '可参阅该字条对口部形象解释及疾病辞例的讨论。',
    sourceTitle: '漢語多功能字庫 · 口',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E5%8F%A3',
    evidence: '字库以口部疾病的辞例说明用义；不将其配给本站「甲1193」的字库图。',
    checkedAt: '2026-10-31',
  },
  牛: {
    description: '可参阅该字条对牛头取象说及甲骨、金文形体的讨论。',
    sourceTitle: '漢語多功能字庫 · 牛',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E7%89%9B',
    evidence: '字库另谈部分商代金文较完整的头部特征，本站不将那些描述全部套到「合9525」这幅甲骨字例。',
    checkedAt: '2026-10-31',
  },
  鱼: {
    description: '可参阅该字条对鱼形解释及不同时期书写变化的讨论。',
    sourceTitle: '漢語多功能字庫 · 魚',
    sourceUrl: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E9%AD%9A',
    evidence: '字库讨论鱼形及后来的书写变化；本站展示「合10492」字例，不把不同年代的形体拼成一幅图。',
    checkedAt: '2026-10-31',
  },
}

const sources = new Map(sourceManifest.map(source => [source.char, source as GlyphSource]))

export const glyphs: GlyphEntry[] = modernIndex.map(item => {
  const source = sources.get(item.char)
  return {
    ...item,
    category: item.category as CategoryId,
    source: canDisplaySource(source) ? source : undefined,
    reading: canDisplaySource(source) ? readingNotes[item.char] : undefined,
  }
})

export const sourcedGlyphs = glyphs.filter(entry => canDisplaySource(entry.source))
export const pendingGlyphs = glyphs.filter(entry => !canDisplaySource(entry.source))

export const traditionalForms: Record<string, string> = {
  云: '雲', 气: '氣', 麦: '麥', 鸟: '鳥', 鱼: '魚', 马: '馬', 龟: '龜', 齿: '齒',
  门: '門', 户: '戶', 网: '網', 车: '車', 册: '冊', 从: '從', 众: '眾',
  电: '電', 风: '風', 鸣: '鳴', 凤: '鳳', 见: '見', 东: '東',
}

const searchAliases: Record<string, string> = { 艸: '草', 冰: '仌', 屮: '草芽' }

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, '')
}

export function matchesSearch(glyph: GlyphEntry, query: string) {
  const needle = normalizeSearch(query)
  return !needle || normalizeSearch(`${glyph.char}${glyph.aliases?.join('') ?? ''}${glyph.headwordNumber ?? ''}${traditionalForms[glyph.char] ?? ''}${searchAliases[glyph.char] ?? ''}${glyph.pinyin}${glyph.english}${glyph.reading?.description ?? ''}${glyph.reading?.sourceTitle ?? ''}${glyph.source?.sourceCode ?? ''}${glyph.source?.record ?? ''}${glyph.examples?.map(source => `${source.sourceCode}${source.record}`).join('') ?? ''}`).includes(needle)
}

export const referenceLinks = [
  { title: '小學堂文字學資料庫', description: '中央研究院 · 字形图片与字例著录', href: 'https://xiaoxue.iis.sinica.edu.tw/' },
  { title: '漢語多功能字庫', description: '香港中文大学 · 可供参阅的字条与引辞', href: 'https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/' },
  { title: '小學堂图片使用许可', description: '查询所得字形图片及属性信息的 CC0 声明', href: 'https://xiaoxue.iis.sinica.edu.tw/License/License' },
]
