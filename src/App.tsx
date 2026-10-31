import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, Info, Search, Shuffle, X } from 'lucide-react'
import { glyphs, matchesSearch, referenceLinks, type GlyphEntry } from './data/glyphs'
import { galleryGlyphs, galleryStats, glyphKey, glyphLabel } from './data/catalogue'
import { canDisplaySource } from './data/provenance'
import { Glyph } from './components/Glyph'
import { Modal } from './components/Modal'
import { COLLECTION_KEY, loadCollection, storeCollection } from './storage'
import './styles.css'
import './sources.css'

const PAGE_SIZE = 48
const browseFilters = [
  { id: 'all', name: '全部' },
  { id: 'references', name: '有参考材料' },
  { id: 'unlabelled', name: '未标汉字' },
] as const
type BrowseFilter = typeof browseFilters[number]['id']

function DetailView({ entry, saved, onSave, onClose, onMove }: {
  entry: GlyphEntry; saved: boolean; onSave: () => void; onClose: () => void; onMove: (direction: number) => void
}) {
  const [exampleIndex, setExampleIndex] = useState(0)
  const examples = entry.examples ?? (entry.source ? [entry.source] : [])
  const source = examples[exampleIndex]
  if (!canDisplaySource(source)) return null
  const label = glyphLabel(entry)
  const reading = source.sourceCode === entry.source?.sourceCode ? entry.reading : undefined
  return (
    <Modal open onClose={onClose} title={`${label} · 字形与材料`} className="detail-modal">
      <div className="detail-layout" onKeyDown={event => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); onMove(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}>
        <div className="detail-art-panel">
          <button className="icon-button detail-panel-close" onClick={onClose} aria-label="关闭弹窗"><X size={18} /></button>
          <div className="detail-art-eyebrow"><span>观 形</span><span>{source.sourceCode}</span></div>
          <div className="detail-glyph-wrap"><Glyph entry={{ ...entry, source }} /></div>
          <div className="detail-art-caption"><span>甲骨文字形 · 字库图</span><span>非原拓</span></div>
          <div className="detail-pagination"><button className="text-button" onClick={() => onMove(-1)} aria-label="上一个字"><ArrowLeft size={16} /> 上一字</button><span>慢慢看</span><button className="text-button" onClick={() => onMove(1)} aria-label="下一个字">下一字 <ArrowRight size={16} /></button></div>
        </div>
        <div className="detail-content">
          <span className="eyebrow">看 字 形 · 找 线 索</span>
          <div className="detail-title-row"><h2 className="numbered-title">{label}</h2><button className={`icon-button detail-save ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={saved ? `取消收藏${label}` : `收藏${label}`} aria-pressed={saved}><Bookmark size={21} fill={saved ? 'currentColor' : 'none'} /></button></div>
          <section className="record-materials" aria-label="这一幅字例的记录">
            <dl className="source-facts"><div><dt>字例</dt><dd>{source.sourceCode}</dd></div><div><dt>著录</dt><dd>{source.record}</dd></div></dl>
            <a className="material-link" href={source.sourceRecordUrl} target="_blank" rel="noreferrer">到小學堂查看这幅字例 <ArrowUpRight size={13} /></a>
          </section>
          <section className="catalogue-labels" aria-label="来源目录的检索标签">
            <h3>小學堂字头检索标签</h3>
            {entry.catalogueLabels?.length ? <p className="catalogue-label-values">{entry.catalogueLabels.join('、')}</p> : <p>目录未列可直接显示的通用汉字标签。</p>}
            <p className="material-note">{entry.catalogueLabels?.length ? '标签来自这一字头下已收录字例的记录，供查找，不作为本站对字形的定名或释义。' : '这不等于断言学界尚未释读。'}</p>
          </section>
          {reading && <section className="reference-materials" aria-labelledby="reference-title">
            <h3 id="reference-title">可参看的材料</h3>
            <a className="material-link" href={reading.sourceUrl} target="_blank" rel="noreferrer">{reading.sourceTitle} <ArrowUpRight size={13} /></a>
            <p>{reading.description}</p>
            <p className="citation-boundary">{reading.evidence}</p>
          </section>}
          {examples.length > 1 && <section className="example-section" aria-label="同一来源字头下的其他字例"><h3>同一目录分组里的字例 <small>{exampleIndex + 1} / {examples.length}</small></h3><div className="example-strip">{examples.map((example, index) => <button key={example.sourceCode} onClick={() => setExampleIndex(index)} aria-label={`查看字例${example.sourceCode}`} aria-pressed={index === exampleIndex}><Glyph entry={{ ...entry, source: example }} decorative /></button>)}</div></section>}
          <details key={source.sourceCode} className="detail-sources"><summary>图片来源与核对记录 <ArrowUpRight size={13} /></summary>
            <h3>这幅字形</h3>
            <dl className="source-facts"><div><dt>来源</dt><dd>中央研究院 · 小學堂文字學資料庫</dd></div><div><dt>字头号</dt><dd>{entry.headwordNumber}</dd></div><div><dt>字例号</dt><dd>{source.sourceCode}</dd></div><div><dt>著录</dt><dd>{source.record}</dd></div><div><dt>许可</dt><dd><a href={source.licensePage} target="_blank" rel="noreferrer">{source.license} <ArrowUpRight size={12} /></a></dd></div></dl>
            <div className="source-actions"><a href={source.sourceRecordUrl} target="_blank" rel="noreferrer">查看字例页 <ArrowUpRight size={13} /></a><a href={source.originalUrl} target="_blank" rel="noreferrer">查看来源图片 <ArrowUpRight size={13} /></a><a href={`https://xiaoxue.iis.sinica.edu.tw/jiaguwen?ZiOrder=${entry.headwordNumber}`} target="_blank" rel="noreferrer">查看字头页 <ArrowUpRight size={13} /></a></div>
            <p className="source-credit">{source.credit} 已检查页面字段对应与图片完整性，未与甲骨原片或原拓逐笔校勘，未经专家审校；按小學堂字头号归组，不据此判定全部字例的分合或古今对应。</p>
            <p className="image-record">核对日期：{source.checkedAt}<br />SHA-256：<code>{source.sha256}</code></p>
          </details>
        </div>
      </div>
    </Modal>
  )
}

function About({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="关于字在" className="about-modal"><div className="about-content">
      <span className="seal small-seal">字</span><h2>看见字形，<br />也留一点疑问。</h2><p>「字在」是一座可以逛、可以查的甲骨文小展馆。展示字形，提供辅助判断的材料，不替字形下定义，也不把古字与现代字直接画等号。</p>
      <h3>收录范围</h3><p>当前有 {galleryStats.headwords.toLocaleString()} 个字头、{galleryStats.examples.toLocaleString()} 幅字例，按小學堂字头号归组。这是来源目录的整理单位，不代表本站对单字分合的判定。约 4,500 是甲骨文单字的常见估计，并不是本站已完成的数量；本字库尚未覆盖全部。</p><p>未标汉字的记录保留原字形与编号，不补造读音、字义，也不把「没有通用标签」当作学界未释读的判断。</p>
      <h3>可以参看什么</h3><p>字形来自中央研究院小學堂的公开查询图片与属性信息，字库图不是原拓。目录标签标明来源，只作查找线索，不是本站的定名或释义。{galleryStats.withReading} 条记录另附香港中文大学漢語多功能字庫的相关字条入口与引辞边界，供参阅，不作为当前图片的配辞或定论。图片、著录和文献讨论分开呈现，不拼接成确定的字源故事。</p>
      <div className="reference-links">{referenceLinks.map(link => <a key={link.title} href={link.href} target="_blank" rel="noreferrer"><span><strong>{link.title}</strong><small>{link.description}</small></span><ArrowUpRight size={18} /></a>)}</div>
      <details className="correction-history"><summary>早期版本更正记录</summary><p>早期版本自行绘制了未经逐例核对的示意图，并提供拆解与练习。这些图形、无据的构形说明及相关练习已撤下，不再以「教学示意」弥补依据不足。当前只展示能列明来源的字例，不凭现代字形补画，也不把不同辞例的图与释文拼接。</p><p>旧收藏会对应到已有字头；尚无字形的旧标签仍保留，不作为空白展品。</p></details>
      <p className="privacy-note"><Bookmark size={14} /> 收藏只保存在当前浏览器，无账号，不上传。</p>
    </div></Modal>
  )
}

export default function App() {
  const [page, setPage] = useState<'gallery' | 'collection'>('gallery')
  const [filter, setFilter] = useState<BrowseFilter>('all')
  const [pageNumber, setPageNumber] = useState(1)
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState<string[]>(loadCollection)
  const [selected, setSelected] = useState<GlyphEntry | null>(null)
  const [about, setAbout] = useState(false)
  const [toast, setToast] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLElement>(null)
  const savedSet = useMemo(() => new Set(collection), [collection])
  const pool = useMemo(() => page === 'collection' ? galleryGlyphs.filter(entry => savedSet.has(glyphKey(entry))) : galleryGlyphs, [page, savedSet])
  const filtered = useMemo(() => pool.filter(entry => (filter === 'all' || (filter === 'references' ? !!entry.reading : !entry.catalogueLabels?.length)) && matchesSearch(entry, query)), [pool, filter, query])
  const previousBookmarks = useMemo(() => glyphs.filter(entry => savedSet.has(entry.char) && !canDisplaySource(entry.source)), [savedSet])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(pageNumber, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (event.key === '/' && !selected && !about && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        event.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, about])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    function syncCollection(event: StorageEvent) {
      if (event.key === COLLECTION_KEY || event.key === null) setCollection(loadCollection())
    }
    window.addEventListener('storage', syncCollection)
    return () => window.removeEventListener('storage', syncCollection)
  }, [])

  function navigate(nextPage: 'gallery' | 'collection') { setPage(nextPage); setFilter('all'); setQuery(''); setPageNumber(1) }
  function updateQuery(value: string) { setQuery(value); setPageNumber(1) }
  function clearFilters() { updateQuery(''); setFilter('all'); searchRef.current?.focus() }
  function toggleSave(key: string, label: string) {
    const wasSaved = savedSet.has(key)
    const next = wasSaved ? collection.filter(item => item !== key) : [...collection, key]
    setCollection(next)
    const persisted = storeCollection(next)
    setToast(!persisted ? '本次已记住；浏览器限制了本地保存' : wasSaved ? `已将「${label}」移出拾字簿` : `「${label}」已收入拾字簿`)
  }
  function moveGlyph(direction: number) {
    if (!selected) return
    const nextPool = filtered.includes(selected) ? filtered : galleryGlyphs
    const index = nextPool.indexOf(selected)
    setSelected(nextPool[(index + direction + nextPool.length) % nextPool.length])
  }
  function randomGlyph() {
    const candidates = filtered.filter(entry => entry !== selected)
    if (candidates.length) setSelected(candidates[Math.floor(Math.random() * candidates.length)])
  }
  function changePage(number: number) {
    setPageNumber(number)
    galleryRef.current?.scrollIntoView({ block: 'start' })
    galleryRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="app-shell simple-app">
      <header className="simple-header"><div className="simple-header-inner">
        <a href="#" className="simple-brand" onClick={event => { event.preventDefault(); navigate('gallery') }} aria-label="字在首页"><span className="seal brand-seal">字</span><span>字在</span></a>
        <nav aria-label="主导航"><button className={page === 'gallery' ? 'active' : ''} aria-current={page === 'gallery' ? 'page' : undefined} onClick={() => navigate('gallery')}>逛字馆</button><button className={page === 'collection' ? 'active' : ''} aria-current={page === 'collection' ? 'page' : undefined} onClick={() => navigate('collection')}><Bookmark size={15} />拾字簿{collection.length > 0 && <small>{collection.length}</small>}</button><button className="icon-button" aria-label="关于字在" onClick={() => setAbout(true)}><Info size={17} /></button></nav>
      </div></header>
      <main className="simple-main">
        <section className="gallery-intro" aria-labelledby="gallery-heading"><div><span className="eyebrow">{page === 'gallery' ? '甲 骨 文 小 展 馆' : 'MY LITTLE COLLECTION'}</span><h1 id="gallery-heading">{page === 'gallery' ? '先看字形，再找线索。' : '喜欢的字，留在这里。'}</h1><p>{page === 'gallery' ? '字例、著录与相关资料，放在一起看。' : '每一次收藏，都是一次新的发现。'}</p></div>
          <div className="search-box"><Search size={17} /><input ref={searchRef} value={query} onChange={event => updateQuery(event.target.value)} placeholder="检索标签、拼音或来源编号" aria-label="搜索标签、拼音或编号" />{query ? <button className="clear-search" onClick={() => { updateQuery(''); searchRef.current?.focus() }} aria-label="清空搜索"><X size={15} /></button> : <kbd>/</kbd>}</div>
        </section>
        <section ref={galleryRef} tabIndex={-1} className="gallery-section" aria-label={page === 'gallery' ? '字形展览' : '收藏的字'}>
          <div className="browse-toolbar"><div className="browse-categories" role="group" aria-label="筛选字库">{browseFilters.map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPageNumber(1) }}>{item.name}</button>)}</div><button className="random-button" aria-label="随遇一字" disabled={!filtered.length} onClick={randomGlyph}><Shuffle size={15} /><span>随遇一字</span></button></div>
          <div className="browse-result-line" role="status"><span>{filtered.length.toLocaleString()} 个字头{query && ' · 搜索结果'}</span>{filtered.length > PAGE_SIZE && <span>第 {currentPage} / {totalPages} 页</span>}</div>
          {query && <p className="search-material-note">搜索匹配目录标签、现代检索词和参考资料，不表示古今字等同。</p>}
          {visible.length > 0 ? <div className="glyph-grid">{visible.map((entry, index) => {
            const label = glyphLabel(entry), key = glyphKey(entry)
            return <article className="glyph-card" key={key} style={{ '--card-index': Math.min(index, 9) } as React.CSSProperties}>
              <button className="card-open" aria-label={`看看${label}`} onClick={() => setSelected(entry)}><div className="card-glyph-area"><Glyph entry={entry} decorative /></div><div className="card-info"><span className="card-character numbered-character">{label}</span><ArrowUpRight className="card-arrow" size={17} /></div><p className="card-caption">{entry.catalogueLabels?.length ? `目录标签 · ${entry.catalogueLabels.join('、')}` : '目录未标汉字'}</p></button>
              <button className={`card-bookmark ${savedSet.has(key) ? 'is-saved' : ''}`} onClick={() => toggleSave(key, label)} aria-label={savedSet.has(key) ? `取消收藏${label}` : `收藏${label}`} aria-pressed={savedSet.has(key)}><Bookmark size={16} fill={savedSet.has(key) ? 'currentColor' : 'none'} /></button>
            </article>
          })}</div> : <div className="empty-state">{page === 'collection' && !query && filter === 'all' ? <><Bookmark size={30} strokeWidth={1} /><h2>{previousBookmarks.length ? '这些收藏的字，暂时还看不到字形。' : '还没有拾起的字。'}</h2><p>{previousBookmarks.length ? '以前的收藏仍为你保留，可以先去看看其他字。' : '点亮字卡上的收藏符号，下次就能在这里找到它。'}</p><button className="primary-button" onClick={() => navigate('gallery')}>去逛逛 <ArrowRight size={15} /></button></> : <><Search size={30} strokeWidth={1} /><h2>还没找到这个字。</h2><p>换个字或编号试试。这里还没有覆盖所有甲骨文字。</p><button className="text-button" onClick={clearFilters}>清除筛选 <ArrowRight size={15} /></button></>}</div>}
          {totalPages > 1 && <nav className="catalogue-pagination" aria-label="字库分页"><button onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} aria-label="上一页"><ArrowLeft size={15} />上一页</button><label><span>第</span><select aria-label="选择字库页码" value={currentPage} onChange={event => changePage(Number(event.target.value))}>{Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span>/ {totalPages} 页</span></label><button onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="下一页">下一页<ArrowRight size={15} /></button></nav>}
          {page === 'collection' && previousBookmarks.length > 0 && <details className="previous-bookmarks"><summary>以前收藏的 {previousBookmarks.length} 个字，暂未收录字形</summary><p>收藏仍为你保留，不用空白字卡占据展览。</p><div>{previousBookmarks.map(entry => <button key={entry.char} onClick={() => toggleSave(entry.char, entry.char)} aria-label={`取消收藏${entry.char}`}>{entry.char}<X size={12} /></button>)}</div></details>}
        </section>
        <footer className="main-footer"><span><span className="footer-brand">字在</span>看见字形，保留疑问。</span><div><span>字形为字库图，非甲骨原拓</span><button onClick={() => setAbout(true)}>收录范围与出处 <ArrowUpRight size={12} /></button></div></footer>
      </main>
      {selected && <DetailView key={glyphKey(selected)} entry={selected} saved={savedSet.has(glyphKey(selected))} onSave={() => toggleSave(glyphKey(selected), glyphLabel(selected))} onClose={() => setSelected(null)} onMove={moveGlyph} />}
      {about && <About onClose={() => setAbout(false)} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  )
}
