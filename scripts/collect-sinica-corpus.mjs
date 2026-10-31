import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const directory = resolve(process.argv[3] ?? `${root}/research/sinica-corpus-20261031`)
const origin = 'https://xiaoxue.iis.sinica.edu.tw'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
await mkdir(directory, { recursive: true })
let lastRequest = 0
let queue = Promise.resolve()
async function request(url, options = {}) {
  const slot = queue.then(async () => {
    await pause(Math.max(0, 600 - (Date.now() - lastRequest)))
    lastRequest = Date.now()
  })
  queue = slot
  await slot
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'ZiZai-source-catalogue/1.0 (educational archive; two workers)', ...options.headers },
    signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) throw new Error(`Stopped on HTTP ${response.status}: ${url}`)
  return response
}
const exists = async path => access(path).then(() => true, () => false)
function decode(value) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ').trim()
}
function parseDirectory(html) {
  const items = []
  for (const match of html.matchAll(/<img\b([^>]+)>\s*<br\s*\/>\s*<a href="(\/jiaguwen\?(?:kaiOrder=\d+&)?ZiOrder=\d+)"[^>]*>(\d+)<\/a>/g)) {
    const code = match[1].match(/alt="&([\d]+\.[a-f0-9]+);"/i)?.[1]
    if (!code || !/^4[1-9]\./.test(code)) throw new Error('Non-oracle image in directory')
    items.push({ order: Number(match[3]), code, catalogueUrl: origin + decode(match[2]) })
  }
  return items
}
const heads = []
let total = 0
for (let page = 1; ; page++) {
  const folder = `${directory}/directory-${String(page).padStart(3, '0')}`
  const file = `${folder}/source.html`
  let html
  if (await exists(file)) html = await readFile(file, 'utf8')
  else {
    await mkdir(folder)
    const body = new URLSearchParams({ FontCode: '1', PageTo: String(page), PaginalColNum: '10', PaginalRowNum: '10', ImageSize: '36', KaishuSimilarParts: 'true', KaishuYouQie: 'true', KaishuFreqCheck: 'false', KaishuFreqOrder: '4000' })
    html = await (await request(`${origin}/ccdb/PageResult/PageResult`, { method: 'POST', body })).text()
    await writeFile(file, html, { flag: 'wx' })
  }
  const count = html.match(/共搜尋到(\d+)字／(\d+)頁/)
  if (!count) throw new Error(`Missing directory count on page ${page}`)
  if (total && total !== Number(count[1])) throw new Error('Source catalogue changed during import')
  total = Number(count[1])
  const items = parseDirectory(html)
  if (!items.length) throw new Error(`Empty directory page ${page}`)
  heads.push(...items)
  console.log(`Directory ${page}/${count[2]}: ${heads.length}/${total}`)
  if (page === Number(count[2])) break
}
if (heads.length !== total || new Set(heads.map(h => h.code)).size !== total) throw new Error('Incomplete or duplicate glyph directory')
await writeFile(`${directory}/headwords.json`, JSON.stringify(heads, null, 2))
let next = 0
let completed = 0
const records = []
async function worker() {
  while (next < heads.length) {
    const head = heads[next++]
    const folder = `${directory}/glyph-${head.code.toLowerCase().replace('.', '-')}`
    await mkdir(folder, { recursive: true })
    const recordPath = `${folder}/record.json`
    if (await exists(recordPath)) {
      records.push(JSON.parse(await readFile(recordPath, 'utf8')))
      completed++
      continue
    }
    const pagePath = `${folder}/page/source.html`
    let html
    if (await exists(pagePath)) html = await readFile(pagePath, 'utf8')
    else {
      await mkdir(`${folder}/page`, { recursive: true })
      html = await (await request(`${origin}/char?fontcode=${head.code}`)).text()
      await writeFile(pagePath, html, { flag: 'wx' })
    }
    const tag = [...html.matchAll(/<img\b[^>]+>/g)].map(m => m[0]).find(t => t.includes(`alt="&${head.code};"`))
    const src = tag?.match(/\bsrc="([^"]+)"/)?.[1]
    const reference = decode(html.match(/<span id="Reference">([\s\S]*?)<\/span>/)?.[1] ?? '')
    if (!src || !reference) throw new Error(`Missing source image/reference for ${head.code}`)
    const originalUrl = new URL(decode(src), origin)
    if (originalUrl.origin !== origin || originalUrl.pathname !== '/ImageText2/ShowImage.ashx') throw new Error('Unexpected image server')
    originalUrl.searchParams.set('size', '200')
    const labels = [...html.matchAll(/alt="&0\.([0-9a-f]+);"/gi)].map(m => String.fromCodePoint(parseInt(m[1], 16)))
    const imagePath = `${folder}/image/source.png`
    let image
    if (await exists(imagePath)) image = await readFile(imagePath)
    else {
      await mkdir(`${folder}/image`, { recursive: true })
      image = Buffer.from(await (await request(originalUrl.href)).arrayBuffer())
      if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || image.length > 1000000) throw new Error(`Invalid PNG for ${head.code}`)
      await writeFile(imagePath, image, { flag: 'wx' })
    }
    const record = { ...head, labels: [...new Set(labels)], reference, originalUrl: originalUrl.href, sourceRecordUrl: `${origin}/char?fontcode=${head.code}`, sha256: createHash('sha256').update(image).digest('hex'), checkedAt: '2026-10-31' }
    await writeFile(recordPath, JSON.stringify(record, null, 2), { flag: 'wx' })
    records.push(record)
    completed++
    if (completed % 50 === 0 || completed === total) console.log(`Source records ${completed}/${total}`)
  }
}
await Promise.all([worker(), worker()])
records.sort((a, b) => a.order - b.order)
if (records.length !== total) throw new Error('Incomplete source collection')
const headwordCount = new Set(records.map(record => record.order)).size
await writeFile(`${directory}/manifest.json`, JSON.stringify({ source: `${origin}/ccdb?ccmapcode=1`, total, headwordCount, checkedAt: '2026-10-31', records }, null, 2))
console.log(`Complete: ${total} catalogue forms grouped under ${headwordCount} native headword numbers; not a claim of 4,500 distinct characters.`)
