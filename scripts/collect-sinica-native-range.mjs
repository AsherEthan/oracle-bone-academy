import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const output = resolve(process.argv[3] ?? `${root}/research/sinica-native-range-20261031`)
const corpus = JSON.parse(await readFile(`${root}/src/data/corpus.json`, 'utf8'))
const baseline = JSON.parse(await readFile(`${root}/research/sinica-corpus-20261031/headwords.json`, 'utf8'))
const supplement = JSON.parse(await readFile(`${root}/research/sinica-unlisted-headwords-20261031/manifest.json`, 'utf8'))
const known = new Set([...baseline, ...supplement.records].map(record => record.order))
const observed = corpus.records.map(record => record.order).filter(order => order >= 3000)
const range = [Math.min(...observed), Math.max(...observed)]
if (range[0] !== 3001 || range[1] !== 5952) throw new Error('Observed native range changed; review the acquisition scope first')
const candidates = Array.from({ length: range[1] - range[0] + 1 }, (_, index) => index + range[0]).filter(order => !known.has(order))
const origin = 'https://xiaoxue.iis.sinica.edu.tw'
const checkedAt = '2026-10-31'
const exists = path => access(path).then(() => true, () => false)
const decode = value => value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number))).replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ').trim()
const referenceText = value => decode(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
await mkdir(output, { recursive: true })
let lastRequest = 0
let queue = Promise.resolve()
async function request(url, options = {}) {
  const slot = queue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 600 - (Date.now() - lastRequest))))
    lastRequest = Date.now()
  })
  queue = slot
  await slot
  const response = await fetch(url, { ...options, headers: { 'User-Agent': 'ZiZai-source-catalogue/1.0 (educational archive; two workers)', ...options.headers }, signal: AbortSignal.timeout(45000) })
  if (!response.ok) throw new Error(`Stopped on HTTP ${response.status}: ${url}`)
  return response
}
async function textSnapshot(path, url, options) {
  if (await exists(path)) return readFile(path, 'utf8')
  const value = await (await request(url, options)).text()
  await writeFile(path, value, { flag: 'wx' })
  return value
}
const records = [], absent = []
let next = 0, completed = 0, stopped = false
let saving = Promise.resolve()
function checkpoint(complete = false) {
  const snapshot = { source: `${origin}/jiaguwen/`, range, candidateCount: candidates.length, complete, checkedAt, records: [...records].sort((a, b) => a.order - b.order), absent: [...absent].sort((a, b) => a - b) }
  saving = saving.then(async () => {
    await writeFile(`${output}/manifest.next.json`, JSON.stringify(snapshot, null, 2))
    await rename(`${output}/manifest.next.json`, `${output}/manifest.json`)
  })
  return saving
}
async function worker() {
  while (!stopped && next < candidates.length) {
    const order = candidates[next++]
    const folder = `${output}/head-${order}`
    await mkdir(folder, { recursive: true })
    if (await exists(`${folder}/record.json`)) {
      const record = JSON.parse(await readFile(`${folder}/record.json`, 'utf8'))
      if (record.order !== order || !/^4[1-9]\.[A-F0-9]+$/.test(record.code)) throw new Error(`Invalid saved record ${order}`)
      records.push(record)
    } else {
      await mkdir(`${folder}/query`, { recursive: true })
      const query = await textSnapshot(`${folder}/query/source.html`, `${origin}/jiaguwen/PageResult/PageResult`, { method: 'POST', body: new URLSearchParams({ ZiOrder: String(order), PaginalZiNum: '5', ImageSize: '36' }) })
      const match = query.match(/共搜尋到(\d+)字/)
      if (!match) throw new Error(`Missing public query count ${order}`)
      const exampleCount = Number(match[1])
      if (exampleCount === 0) absent.push(order)
      else {
        if (!query.includes(`id="StartOrder">${order}</span>`)) throw new Error(`Headword redirected ${order}`)
        const code = query.match(/alt="&(4[1-9]\.[A-F0-9]+);"/i)?.[1]
        if (!code) throw new Error(`No source-numbered oracle example ${order}`)
        await mkdir(`${folder}/page`, { recursive: true })
        const html = await textSnapshot(`${folder}/page/source.html`, `${origin}/char?fontcode=${code}`)
        const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`alt="&${code};"`))
        const src = tag?.match(/\bsrc="([^"]+)"/)?.[1]
        const reference = referenceText(html.match(/<span id="Reference">([\s\S]*?)<\/span>/)?.[1] ?? '')
        if (!src || !reference) throw new Error(`Missing primary source attributes ${order}/${code}`)
        const url = new URL(decode(src), origin)
        if (url.origin !== origin || url.pathname !== '/ImageText2/ShowImage.ashx') throw new Error(`Unexpected source image ${code}`)
        url.searchParams.set('size', '200')
        await mkdir(`${folder}/image`, { recursive: true })
        const imageFile = `${folder}/image/source.png`
        const image = await exists(imageFile) ? await readFile(imageFile) : Buffer.from(await (await request(url.href)).arrayBuffer())
        if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || image.length > 1000000) throw new Error(`Invalid PNG ${code}`)
        if (!await exists(imageFile)) await writeFile(imageFile, image, { flag: 'wx' })
        const labels = [...new Set([...html.matchAll(/alt="&0\.([0-9a-f]+);"/gi)].map(match => String.fromCodePoint(parseInt(match[1], 16))))].filter(label => /^\p{Script=Han}$/u.test(label))
        const record = { order, code, catalogueUrl: `${origin}/jiaguwen?ZiOrder=${order}`, labels, reference, originalUrl: url.href, sourceRecordUrl: `${origin}/char?fontcode=${code}`, sha256: createHash('sha256').update(image).digest('hex'), exampleCount, checkedAt, folder: `head-${order}` }
        await writeFile(`${folder}/record.json`, JSON.stringify(record, null, 2), { flag: 'wx' })
        records.push(record)
      }
    }
    completed++
    if (completed % 50 === 0 || completed === candidates.length) {
      await checkpoint()
      console.log(`Native range ${completed}/${candidates.length}; ${records.length} actual records, ${absent.length} empty queries`)
    }
  }
}
console.log(`Checking ${candidates.length} uncollected IDs within the observed native range ${range.join('–')}; no claim of independent characters or complete variants.`)
const results = await Promise.allSettled([worker().catch(error => { stopped = true; throw error }), worker().catch(error => { stopped = true; throw error })])
const failure = results.find(result => result.status === 'rejected')
await checkpoint(!failure && completed === candidates.length)
if (failure) throw failure.reason
console.log(`Range complete: ${records.length} additional source-native headword records, ${absent.length} empty queries; not a scholarly single-character count.`)
